import copy
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
import urllib.error
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('gcs', Path(__file__).with_name('gcs.py'))
gcs = importlib.util.module_from_spec(spec); spec.loader.exec_module(gcs)
identity = gcs.identity_module


class IdentityTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.executable = self.root / 'gcloud'; self.executable.touch()
        self.settings = {'gcloud': str(self.executable), 'bucket': 'fixture-backup', 'project': 'fixture-project', 'identities': {}}
        for role in ('writer', 'auditor'):
            directory = self.root / role; directory.mkdir(mode=0o700)
            self.settings['identities'][role] = {'gcloud_config': str(directory), 'account': role + '-fixture@fixture-project.iam.gserviceaccount.com'}
        self.calls = []
        self.env = patch.dict(os.environ, {'HOME': str(self.root), 'PATH': '/usr/bin:/bin'}, clear=True)
        self.env.start(); self.addCleanup(self.env.stop)

    def output(self, command, **kwargs):
        self.calls.append((command,kwargs))
        role = Path(kwargs['env']['CLOUDSDK_CONFIG']).name
        account = self.settings['identities'][role]['account']
        if command[1:3] == ['config','list']: return json.dumps({'core': {'account': account}}).encode()
        if command[1:3] == ['auth','list']: return json.dumps([{'account':account,'status':'ACTIVE'}]).encode()
        if command[1:3] == ['auth','print-access-token']: return b'fixture-only-token'
        return b'{}'

    def test_all_calls_and_upload_share_only_the_pinned_writer(self):
        with patch.object(identity.subprocess, 'check_output', side_effect=self.output), patch.object(identity.subprocess, 'run') as run:
            cloud = gcs.Cloud(self.settings)
            cloud.cli(['storage','buckets','get-iam-policy','gs://fixture-backup'])
            cloud.copy(Path('/fixture.age'),'gs://fixture-backup/beanmap/daily/backup-fixture/database.dump.age',md5='fixture-md5',sha256='fixture-sha')
        for command,kw in self.calls+[(run.call_args.args[0],run.call_args.kwargs)]:
            self.assertIn('--account='+self.settings['identities']['writer']['account'],command)
            self.assertIn('--configuration=default',command)
            self.assertEqual(kw['env']['CLOUDSDK_CONFIG'],str(self.root/'writer'))
            self.assertNotIn('GOOGLE_APPLICATION_CREDENTIALS',kw['env'])
        self.assertIn('--if-generation-match=0',run.call_args.args[0])
        self.assertEqual(run.call_args.kwargs['env']['CLOUDSDK_STORAGE_PARALLEL_COMPOSITE_UPLOAD_ENABLED'],'false')

    def test_auditor_is_separate_and_cannot_copy(self):
        with patch.object(identity.subprocess,'check_output',side_effect=self.output),patch.object(identity.subprocess,'run') as run:
            cloud=gcs.Cloud(self.settings,role='auditor')
            with self.assertRaises(ValueError):cloud.copy('/fixture','gs://fixture-backup/beanmap/daily/x/a',md5='x',sha256='x')
            run.assert_not_called()
        self.assertTrue(all(kw['env']['CLOUDSDK_CONFIG']==str(self.root/'auditor') for _,kw in self.calls))

    def test_external_overrides_fail_before_any_gcloud_access(self):
        for variable in ['CLOUDSDK_CONFIG','CLOUDSDK_CORE_ACCOUNT','CLOUDSDK_ACTIVE_CONFIG_NAME','CLOUDSDK_AUTH_ACCESS_TOKEN','CLOUDSDK_AUTH_ACCESS_TOKEN_FILE','CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE','CLOUDSDK_AUTH_IMPERSONATE_SERVICE_ACCOUNT','GOOGLE_APPLICATION_CREDENTIALS','HTTPS_PROXY','https_proxy','SSL_CERT_FILE']:
            with self.subTest(variable=variable),patch.dict(os.environ,{variable:'fixture'}),patch.object(identity.subprocess,'check_output') as output:
                with self.assertRaises(ValueError):gcs.Cloud(self.settings)
                output.assert_not_called()

    def test_stored_overrides_fail_before_token_mint(self):
        for section,key,value in [('auth','impersonate_service_account','other'),('auth','access_token_file','/fixture'),('auth','credential_file_override','/fixture'),('auth','disable_credentials',True),('auth','token_host','https://example.invalid'),('core','disable_ssl_validation',True),('core','log_http',True),('api_endpoint_overrides','storage','https://example.invalid'),('proxy','address','example.invalid')]:
            properties={'core':{'account':self.settings['identities']['writer']['account']}}
            properties.setdefault(section,{})[key]=value
            with self.subTest(section=section,key=key),patch.object(identity.subprocess,'check_output',return_value=json.dumps(properties).encode()) as output:
                with self.assertRaises(ValueError):gcs.Cloud(self.settings)
                self.assertEqual(output.call_count,1)

    def test_wrong_or_additional_personal_accounts_fail(self):
        account=self.settings['identities']['writer']['account']
        for properties,accounts in [({'core':{'account':'personal@example.test'}},[]),({'core':{'account':account}},[{'account':account},{'account':'personal@example.test'}]),({'core':{'account':account}},[{'account':'other@fixture-project.iam.gserviceaccount.com'}])]:
            with self.subTest(accounts=accounts),patch.object(identity.subprocess,'check_output',side_effect=[json.dumps(properties).encode(),json.dumps(accounts).encode()]) as output:
                with self.assertRaises(ValueError):gcs.Cloud(self.settings)
                self.assertLessEqual(output.call_count,2)

    def test_no_default_relative_symlink_or_shared_identity(self):
        cases=[]
        for value in ['relative/path',str(self.root/'missing')]:
            settings=copy.deepcopy(self.settings);settings['identities']['writer']['gcloud_config']=value;cases.append(settings)
        link=self.root/'linked';link.symlink_to(self.root/'writer',target_is_directory=True)
        settings=copy.deepcopy(self.settings);settings['identities']['writer']['gcloud_config']=str(link);cases.append(settings)
        settings=copy.deepcopy(self.settings);settings['identities']['writer']=settings['identities']['auditor'];cases.append(settings)
        for settings in cases:
            with self.subTest(settings=settings),self.assertRaises((ValueError,FileNotFoundError)):gcs.Cloud(settings)
        (self.root/'writer').chmod(0o755)
        with self.assertRaises(ValueError):gcs.Cloud(self.settings)

    def test_cross_bucket_and_prefix_uploads_are_rejected(self):
        with patch.object(identity.subprocess,'check_output',side_effect=self.output):cloud=gcs.Cloud(self.settings)
        for target in ['gs://other/beanmap/daily/a','gs://fixture-backup/elsewhere/a','gs://fixture-backup/beanmap/other/a']:
            with self.subTest(target=target),patch.object(identity.subprocess,'run') as run,self.assertRaises(ValueError):
                cloud.copy('/fixture',target,md5='x',sha256='x')
                run.assert_not_called()

    def test_each_forbidden_permission_fails_closed(self):
        cloud=object.__new__(gcs.Cloud)
        for role in ('writer','auditor'):
            cloud.role=role
            denied=gcs.DENIED_PERMISSIONS|({'storage.objects.get','storage.objects.create'} if role=='auditor' else set())
            for permission in denied:
                cloud.get=lambda *a,**kw:{'permissions':list(gcs.READ_PERMISSIONS|{permission})}
                with self.subTest(role=role,permission=permission),self.assertRaises(ValueError):cloud.check_permissions('fixture-backup')
            for missing in gcs.READ_PERMISSIONS:
                cloud.get=lambda *a,**kw:{'permissions':list(gcs.READ_PERMISSIONS-{missing})}
                with self.subTest(role=role,missing=missing),self.assertRaises(ValueError):cloud.check_permissions('fixture-backup')
            cloud.get=lambda *a,**kw:{'permissions':list(gcs.READ_PERMISSIONS)}
            cloud.check_permissions('fixture-backup')

    def test_ubla_permission_api_does_not_request_disabled_object_acl_permissions(self):
        cloud=object.__new__(gcs.Cloud)
        requested=[]
        def ubla_api(path,**query):
            permissions=set(query['permissions']);requested.append(permissions)
            if permissions & {'storage.objects.getIamPolicy','storage.objects.setIamPolicy'}:
                raise urllib.error.HTTPError('https://storage.googleapis.com/fixture',400,'Object ACL permission tests are disabled with UBLA',{},None)
            return {'permissions':list(gcs.READ_PERMISSIONS)}
        cloud.get=ubla_api
        for role in ('writer','auditor'):
            cloud.role=role;cloud.check_permissions('fixture-backup')
        for permissions in requested:
            self.assertTrue({'storage.objects.update','storage.objects.delete','storage.buckets.setIamPolicy','storage.buckets.update','storage.buckets.delete'} <= permissions)

    def test_writer_never_executes_billing_inventory(self):
        cloud=object.__new__(gcs.Cloud);cloud.role='writer'
        with patch.object(cloud,'cli') as cli,self.assertRaises(ValueError):
            cloud.billing_inventory('fixture-project','fixture-backup')
            cli.assert_not_called()

    def test_independent_auditor_inventory_and_writer_target_checks(self):
        cloud=object.__new__(gcs.Cloud);cloud.role='writer';cloud.settings=self.settings
        target={'name':'fixture-backup','projectNumber':'123','metageneration':'2','location':'US-WEST1','storageClass':'STANDARD','iamConfiguration':{'uniformBucketLevelAccess':{'enabled':True},'publicAccessPrevention':'enforced'}}
        cloud.get=lambda *a,**kw:target;cloud.cli=lambda args:{'bindings':[]}
        with patch.object(cloud,'check_permissions') as writer_permissions,patch.object(gcs,'Cloud') as factory:
            auditor=factory.return_value;auditor.billing_inventory.return_value=(321,target,[{'name':'fixture'}])
            result=cloud.inventory('fixture-project','fixture-backup')
            factory.assert_called_once_with(self.settings,role='auditor')
            auditor.check_permissions.assert_called_once_with('fixture-backup')
            writer_permissions.assert_called_once_with('fixture-backup')
            self.assertEqual(result,(321,target,[{'name':'fixture'}]))
        for mismatch in ('metageneration','projectNumber'):
            changed={**target,mismatch:'999'};cloud.get=lambda *a,**kw:changed
            with patch.object(cloud,'check_permissions'),patch.object(gcs,'Cloud') as factory:
                factory.return_value.billing_inventory.return_value=(321,target,[])
                with self.assertRaises(ValueError):cloud.inventory('fixture-project','fixture-backup')

    def test_writer_api_scope_and_auditor_media_stop_before_transport(self):
        cloud=object.__new__(gcs.Cloud);cloud.settings=self.settings;cloud.requests=0
        for role,path,query in [('writer','b/other',{}),('writer','b/fixture-backup/o/other-prefix%2Fobject',{}),('auditor','b/fixture-backup/o/beanmap%2Fa',{'alt':'media'})]:
            cloud.role=role
            with self.subTest(role=role,path=path),patch.object(gcs.urllib.request,'build_opener') as opener:
                with self.assertRaises(ValueError):cloud.get(path,**query)
                opener.assert_not_called()

    def test_auditor_failure_prevents_writer_reads(self):
        cloud=object.__new__(gcs.Cloud);cloud.role='writer';cloud.settings=self.settings
        with patch.object(gcs,'Cloud') as factory,patch.object(cloud,'get') as writer_get:
            factory.return_value.billing_inventory.side_effect=PermissionError('fixture linked-project denial')
            with self.assertRaises(PermissionError):cloud.inventory('fixture-project','fixture-backup')
            writer_get.assert_not_called()


if __name__=='__main__':unittest.main()
