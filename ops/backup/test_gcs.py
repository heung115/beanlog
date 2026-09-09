import copy
import base64
import hashlib
import json
import tempfile
import urllib.parse
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('gcs', Path(__file__).with_name('gcs.py'))
gcs = importlib.util.module_from_spec(spec); spec.loader.exec_module(gcs)


def bucket():
    return {'name': 'fixture-backup', 'location': 'US-WEST1', 'storageClass': 'STANDARD',
            'iamConfiguration': {'uniformBucketLevelAccess': {'enabled': True}, 'publicAccessPrevention': 'enforced'}}


class GcsTests(unittest.TestCase):
    def test_only_private_regional_standard_bucket_is_accepted(self):
        good = bucket(); gcs.eligible(good)
        changes = [('location', 'ASIA-NORTHEAST3'), ('location', 'US'), ('storageClass', 'NEARLINE'),
                   ('versioning', {'enabled': True}), ('autoclass', {'enabled': True}),
                   ('softDeletePolicy', {'retentionDurationSeconds': '604800'}),
                   ('retentionPolicy', {'retentionPeriod': '86400', 'isLocked': True}),
                   ('defaultEventBasedHold', True)]
        for name, value in changes:
            with self.subTest(name=name, value=value):
                changed = copy.deepcopy(good); changed[name] = value
                with self.assertRaises(ValueError): gcs.eligible(changed)
        for field, value in [('uniformBucketLevelAccess', {'enabled': False}), ('publicAccessPrevention', 'inherited')]:
            changed = copy.deepcopy(good); changed['iamConfiguration'][field] = value
            with self.assertRaises(ValueError): gcs.eligible(changed)

    def test_capacity_rejects_unknown_negative_or_over_limit(self):
        gcs.capacity(1_600_000_000, 1_500_000_000)
        for values in [(-1, 10), (100, 0), (4_000_000_000, 1), (0, 1, 5_000_000_000)]:
            with self.subTest(values=values), self.assertRaises(ValueError): gcs.capacity(*values)

    def test_lifecycle_never_deletes_image_baseline(self):
        good = bucket(); good['lifecycle'] = {'rule': [{'action': {'type': 'Delete'}, 'condition': {'age': 30, 'matchesPrefix': ['beanmap/daily/']}}]}
        gcs.verify_lifecycle(good)
        good['lifecycle']['rule'][0]['condition']['matchesPrefix'] = ['beanmap/']
        with self.assertRaises(ValueError): gcs.verify_lifecycle(good)

    def test_unapproved_upload_stops_before_local_or_remote_access(self):
        with patch.object(gcs.backup, 'validate') as validate:
            with self.assertRaises(ValueError): gcs.upload({}, Path('/invalid'), 'daily')
            validate.assert_not_called()

    def test_daily_rejects_all_image_payloads_before_cloud_authentication(self):
        directory = Path('/fixture/backup-20260909T000000Z-00000000')
        for name in ('images.tar.age', 'images.tar.gz.age', 'images.delta.tar.gz.age', 'image-base.json.age'):
            with self.subTest(name=name), patch.object(gcs.backup, 'validate', return_value={'files': {name: {}}}), patch.object(gcs, 'Cloud') as cloud:
                with self.assertRaises(ValueError): gcs.upload({}, directory, 'daily', approved=True)
                cloud.assert_not_called()

    def test_pagination_includes_empty_intermediate_page(self):
        cloud = object.__new__(gcs.Cloud)
        pages = iter([{'items': [{'size': '1'}], 'nextPageToken': 'first'}, {'nextPageToken': 'second'}, {'items': [{'size': '2'}]}])
        cloud.get = lambda *args, **kwargs: next(pages)
        self.assertEqual(cloud.pages('b/test/o'), [{'size': '1'}, {'size': '2'}])

    def test_upload_is_scoped_resumable_and_manifest_last(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary) / 'backup-20260909T000000Z-00000000'; directory.mkdir()
            for name in ('database.dump.age', 'roles.sql.age'): (directory / name).write_bytes(b'fixture encrypted bytes')
            manifest = {'format': 1, 'files': {name: {'bytes': (directory / name).stat().st_size, 'sha256': gcs.backup.digest(directory / name)} for name in ('database.dump.age', 'roles.sql.age')}}
            (directory / 'manifest.json').write_text(json.dumps(manifest))
            prefix = 'beanmap/daily/' + directory.name + '/'
            def metadata(path):
                return {'name': prefix + path.name, 'size': str(path.stat().st_size), 'md5Hash': base64.b64encode(hashlib.md5(path.read_bytes()).digest()).decode(), 'metadata': {'sha256': gcs.backup.digest(path)}}
            target = bucket(); target['metageneration'] = '2'; target['lifecycle'] = {'rule': [{'action': {'type': 'Delete'}, 'condition': {'age': 30, 'matchesPrefix': ['beanmap/daily/']}}]}
            class FakeCloud:
                def inventory(self, *args): return 23, target, [metadata(directory / 'database.dump.age')]
                def get(self, path): return metadata(directory / urllib.parse.unquote(path.split('/o/')[1]).rsplit('/', 1)[-1])
                def copy(self, source, target, **kwargs): calls.append((source,target,kwargs))
            settings = {'gcloud': '/fake/gcloud', 'bucket': 'fixture-backup', 'project': 'fixture-project', 'bucket_metageneration': '2'}
            calls = []
            result = gcs.upload(settings, directory, 'daily', approved=True, cloud=FakeCloud())
            self.assertEqual(len(calls), 2)
            self.assertTrue(calls[-1][1].endswith('/manifest.json'))
            for source,target,kwargs in calls:
                self.assertEqual(kwargs['sha256'], gcs.backup.digest(source))
            self.assertEqual(result['status'], 'uploaded')

    def test_inventory_rejects_missing_target_or_inaccessible_billing(self):
        cloud = object.__new__(gcs.Cloud)
        cloud.role = 'auditor'
        cloud.cli = lambda args: {'billingEnabled': False}
        with self.assertRaises(ValueError): cloud.billing_inventory('fixture-project', 'fixture-backup')

    def test_inventory_counts_complete_billing_pool_and_versions(self):
        cloud = object.__new__(gcs.Cloud)
        cloud.role = 'auditor'
        def cli(args):
            if args[:3] == ['billing', 'projects', 'describe']:
                return {'billingEnabled': True, 'billingAccountName': 'billingAccounts/fixture'}
            if args[:3] == ['billing', 'projects', 'list']:
                return [{'projectId': 'fixture-project'}]
            return {'bindings': []}
        def pages(path, **kwargs):
            if path == 'b':
                value = bucket()
                if kwargs['project'] == 'fixture-other': value['name'] = 'fixture-other-bucket'
                return [value]
            self.assertEqual(kwargs.get('versions'), 'true')
            return [{'name': 'object', 'size': '150', 'storageClass': 'STANDARD'}, {'name': 'object', 'size': '150', 'storageClass': 'STANDARD'}]
        cloud.cli, cloud.pages = cli, pages
        total, target, objects = cloud.billing_inventory('fixture-project', 'fixture-backup')
        self.assertEqual(total, 300); self.assertEqual(target['name'], 'fixture-backup'); self.assertEqual(len(objects), 2)


if __name__ == '__main__': unittest.main()
