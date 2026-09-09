"""Dedicated, pinned gcloud credentials. Never fall back to a personal profile."""
import json
import os
from pathlib import Path
import re
import stat
import subprocess

ACCOUNT = re.compile(r'[a-z][a-z0-9-]{4,28}[a-z0-9]@[a-z][a-z0-9-]{4,61}[a-z0-9]\.iam\.gserviceaccount\.com')
FORBIDDEN_ENV = {'GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_AUTH_TOKEN', 'GOOGLE_OAUTH_ACCESS_TOKEN',
                 'GCE_METADATA_HOST', 'GCE_METADATA_IP', 'GCE_METADATA_ROOT', 'BOTO_CONFIG', 'BOTO_PATH',
                 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'REQUESTS_CA_BUNDLE', 'CURL_CA_BUNDLE',
                 'SSL_CERT_FILE', 'SSL_CERT_DIR'}


def identity(settings, role):
    if role not in ('writer', 'auditor'):
        raise ValueError('Invalid backup identity role')
    value = settings.get('identities', {}).get(role, {})
    if not isinstance(value, dict) or not ACCOUNT.fullmatch(value.get('account', '')):
        raise ValueError('Pin an expected service account for each backup role')
    raw = value.get('gcloud_config', '')
    directory = Path(raw)
    if not directory.is_absolute() or '..' in directory.parts or directory.resolve() != directory:
        raise ValueError('Dedicated gcloud config must be an absolute nonsymlink directory')
    if directory == (Path.home() / '.config/gcloud').resolve():
        raise ValueError('Personal default gcloud configuration is not permitted')
    info = directory.stat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
        raise ValueError('Dedicated gcloud config must be owned by this user with mode 0700')
    return value['account'], str(directory)


def environment(directory):
    for name in os.environ:
        if name.upper().startswith(('CLOUDSDK_', 'GOOGLE_AUTH_')) or name.upper() in FORBIDDEN_ENV:
            raise ValueError('Ambient cloud authentication or transport overrides are forbidden')
    # Only ordinary process essentials are inherited. No credentials, proxies,
    # CA substitutions, Python startup hooks, or gcloud configuration overrides.
    result = {key: os.environ[key] for key in ('HOME', 'PATH', 'LANG', 'LC_ALL', 'TMPDIR', 'TMP', 'TEMP') if key in os.environ}
    result.update(CLOUDSDK_CONFIG=directory, CLOUDSDK_CORE_DISABLE_PROMPTS='1',
                  CLOUDSDK_CORE_DISABLE_USAGE_REPORTING='true',
                  CLOUDSDK_STORAGE_PARALLEL_COMPOSITE_UPLOAD_ENABLED='false')
    return result


class DedicatedIdentity:
    def __init__(self, settings, role):
        self.role = role
        self.account, directory = identity(settings, role)
        other = 'auditor' if role == 'writer' else 'writer'
        other_account, other_directory = identity(settings, other)
        if self.account == other_account or directory == other_directory:
            raise ValueError('Writer and auditor must use distinct service accounts and config directories')
        self.executable = settings.get('gcloud', '')
        if not Path(self.executable).is_absolute() or not Path(self.executable).is_file():
            raise ValueError('Pin an absolute installed gcloud executable')
        self.environment = environment(directory)
        self.settings = settings
        properties = self.cli(['config', 'list', '--all'])
        if properties.get('core', {}).get('account') != self.account:
            raise ValueError('Dedicated gcloud profile account differs from the expected service account')
        auth = properties.get('auth', {})
        if any(auth.get(key) not in (None, '', False, 'false', '(unset)') for key in
               ('access_token', 'access_token_file', 'credential_file_override', 'impersonate_service_account',
                'disable_credentials', 'token_host', 'login_config_file')):
            raise ValueError('Stored authentication override is forbidden')
        for section in ('api_endpoint_overrides', 'proxy'):
            if any(value not in (None, '', False, 'false', '(unset)') for value in properties.get(section, {}).values()):
                raise ValueError('Stored authentication or transport override is forbidden')
        core = properties.get('core', {})
        if core.get('universe_domain') not in (None, '', 'googleapis.com', '(unset)'):
            raise ValueError('Alternate cloud universe is forbidden')
        storage = properties.get('storage', {})
        if any(storage.get(key) not in (None, '', False, 'false', '(unset)') for key in
               ('endpoint_url', 'additional_headers', 'reauth_token', 'encryption_key')):
            raise ValueError('Stored storage endpoint or header override is forbidden')
        if any(core.get(key) not in (None, '', False, 'false', '(unset)') for key in
               ('custom_ca_certs_file', 'disable_ssl_validation', 'log_http', 'trace_token')):
            raise ValueError('Stored credential transport or logging override is forbidden')
        accounts = self.cli(['auth', 'list'])
        if not isinstance(accounts, list) or len(accounts) != 1 or accounts[0].get('account') != self.account:
            raise ValueError('Dedicated credential store must contain only its pinned service account')
        self.token = subprocess.check_output(self.command(['auth', 'print-access-token']),
                                            stderr=subprocess.DEVNULL, env=self.environment).decode().strip()
        if not self.token or any(character.isspace() for character in self.token):
            raise ValueError('Invalid dedicated service-account token')

    def command(self, args):
        return [self.executable, *args, '--configuration=default', '--account=' + self.account]

    def cli(self, args):
        return json.loads(subprocess.check_output(self.command([*args, '--format=json']),
                                                  stderr=subprocess.DEVNULL, env=self.environment))

    def copy(self, source, target, *, md5, sha256):
        if self.role != 'writer':
            raise ValueError('The capacity auditor cannot upload objects')
        expected = 'gs://' + self.settings['bucket'] + '/beanmap/'
        if not target.startswith(expected) or not any(target.startswith(expected + kind + '/') for kind in ('daily', 'baseline')) or any(part in ('', '.', '..') for part in target[len(expected):].split('/')):
            raise ValueError('Upload target is outside the reviewed backup prefix')
        subprocess.run(self.command(['storage', 'cp', str(source), target, '--if-generation-match=0',
                                     '--content-md5=' + md5, '--content-type=application/octet-stream',
                                     '--custom-metadata=sha256=' + sha256, '--quiet']),
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True, env=self.environment)
