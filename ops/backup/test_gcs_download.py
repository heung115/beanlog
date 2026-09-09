import base64
import hashlib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('download', Path(__file__).with_name('gcs_download.py'))
download = importlib.util.module_from_spec(spec); spec.loader.exec_module(download)


class Response(io.BytesIO):
    def __init__(self, data, content_range, status=206):
        super().__init__(data); self.status=status; self.headers={'Content-Range':content_range}


class DownloadTests(unittest.TestCase):
    def test_valid_ranges_are_verified_then_renamed(self):
        payload=b'encrypted-fixture'; sha=hashlib.sha256(payload).hexdigest()
        metadata={'size':len(payload),'generation':'123','metadata':{'sha256':sha},'md5Hash':base64.b64encode(hashlib.md5(payload).digest()).decode()}
        with tempfile.TemporaryDirectory() as temporary, patch.object(download,'RANGE_BYTES',5), patch.object(download,'open_range',side_effect=lambda c,b,n,g,s,e:Response(payload[s:e+1],f'bytes {s}-{e}/{len(payload)}')):
            target=Path(temporary)/'fixture.age';result=download.download(None,'bucket','name',metadata,target,sha)
            self.assertEqual(target.read_bytes(),payload);self.assertEqual(result['status'],'verified')
            self.assertEqual(target.stat().st_mode&0o777,0o600)

    def test_wrong_range_truncation_and_checksum_never_publish(self):
        payload=b'cipher';sha=hashlib.sha256(payload).hexdigest()
        metadata={'size':len(payload),'generation':'123','metadata':{'sha256':sha},'md5Hash':base64.b64encode(hashlib.md5(payload).digest()).decode()}
        for kind in ('range','truncated','corrupt','status'):
            with self.subTest(kind=kind),tempfile.TemporaryDirectory() as temporary:
                response=Response(payload[:-1] if kind=='truncated' else (b'xxxxxx' if kind=='corrupt' else payload),'bad' if kind=='range' else 'bytes 0-5/6',200 if kind=='status' else 206)
                target=Path(temporary)/'fixture.age'
                with patch.object(download,'open_range',return_value=response),self.assertRaises(ValueError):download.download(None,'bucket','name',metadata,target,sha)
                self.assertFalse(target.exists());self.assertFalse(target.with_name('fixture.age.direct-partial').exists())

    def test_existing_partial_is_not_deleted_by_failed_exclusive_create(self):
        payload=b'cipher';sha=hashlib.sha256(payload).hexdigest()
        metadata={'size':len(payload),'generation':'123','metadata':{'sha256':sha},'md5Hash':base64.b64encode(hashlib.md5(payload).digest()).decode()}
        with tempfile.TemporaryDirectory() as temporary:
            target=Path(temporary)/'fixture.age';partial=target.with_name('fixture.age.direct-partial');partial.write_bytes(b'existing job')
            with self.assertRaises(FileExistsError):download.download(None,'bucket','name',metadata,target,sha)
            self.assertEqual(partial.read_bytes(),b'existing job')

    def test_cross_host_or_plaintext_redirect_is_rejected(self):
        handler=download.SameHostRedirect()
        for url in ('https://example.invalid/a','http://storage.googleapis.com/a','https://user:pass@storage.googleapis.com/a','https://storage.googleapis.com:444/a'):
            with self.subTest(url=url),self.assertRaises(ValueError):handler.redirect_request(None,None,302,'',{},url)


if __name__=='__main__':unittest.main()
