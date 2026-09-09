#!/usr/bin/env python3
"""Explicit disposable DB only; two real sessions test collection write skew."""
import os
import json
import subprocess
import time

URL = os.environ["ACL_TEST_DATABASE_URL"]
COMMAND = ["psql", "-X", URL, "-qAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"]
USER = "a3400000-0000-0000-0000-000000000002"
BEAN = "c3400000-0000-0000-0000-000000000002"


def execute(sql):
    result = subprocess.run(COMMAND, input=sql, text=True, capture_output=True, timeout=15)
    if result.returncode:
        raise AssertionError(result.stderr)
    return result.stdout.strip()


def cleanup():
    execute(f"delete from auth.users where id='{USER}';")


for isolation, expected_code in [("read committed", "23514"), ("repeatable read", "40001")]:
    first = second = None
    try:
        execute(f"""begin;
        insert into auth.users(id,email,raw_user_meta_data) values ('{USER}','concurrency-fixture@example.test','{{}}');
        insert into public.beans(id,user_id,name,roastery,note,bean_type,origin_country,process_method,roast_level,place_type,overall_score)
        values ('{BEAN}','{USER}','Concurrent fixture','Fixture','Note','single_origin','Ethiopia','washed','light','home',8);
        insert into public.tasting_tags(bean_id,user_id,tag,category)
        select '{BEAN}','{USER}','initial-'||n,'sweet' from generate_series(1,29)n;
        commit;""")
        first = subprocess.Popen(COMMAND, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        first.stdin.write(f"begin; insert into public.tasting_tags(bean_id,user_id,tag,category) values('{BEAN}','{USER}','first','sweet'); select 'LOCKED';\n")
        first.stdin.flush()
        if first.stdout.readline().strip() != "LOCKED":
            raise AssertionError("First writer did not acquire its parent lock")
        second = subprocess.Popen(COMMAND, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        second.stdin.write(f"set application_name='beanmap-collection-second'; begin isolation level {isolation}; select count(*) from public.tasting_tags where bean_id='{BEAN}'; insert into public.tasting_tags(bean_id,user_id,tag,category) values('{BEAN}','{USER}','second','sweet'); commit;\n")
        second.stdin.close()
        second.stdin = None
        if second.stdout.readline().strip() != "29":
            raise AssertionError("Second transaction did not start from the competing snapshot")
        deadline = time.monotonic() + 10
        while execute("select exists(select 1 from pg_stat_activity where application_name='beanmap-collection-second' and wait_event_type='Lock');") != "t":
            if time.monotonic() >= deadline:
                raise AssertionError("Competing child write was not serialized on its parent")
            time.sleep(0.05)
        first.stdin.write("commit;\n")
        first.stdin.close()
        first.stdin = None
        _, first_error = first.communicate(timeout=10)
        _, second_error = second.communicate(timeout=10)
        if first.returncode or not second.returncode or expected_code not in second_error:
            raise AssertionError(f"Unexpected concurrency outcome: {first_error} {second_error}")
        if execute(f"select count(*) from public.tasting_tags where bean_id='{BEAN}';") != "30":
            raise AssertionError("Concurrent writers committed more than 30 tags")
        print(f"PASS {isolation}: second write rejected with {expected_code}")
    finally:
        for process in [first, second]:
            if process and process.poll() is None:
                process.terminate()
                process.wait(timeout=10)
        cleanup()

# Versioned RPC replacements serialize on the same parent even while child
# DELETE/INSERT operations change its persisted component set.
SESSION = "b3400000-0000-0000-0000-000000000002"
claims = json.dumps({"role": "authenticated", "sub": USER, "session_id": SESSION})
for isolation, expected_code in [("read committed", "PT409"), ("repeatable read", "40001")]:
    first = second = None
    try:
        execute(f"""begin;
        insert into auth.users(id,email,raw_user_meta_data) values ('{USER}','blend-concurrency@example.test','{{}}');
        insert into auth.sessions(id,user_id,created_at) values ('{SESSION}','{USER}',now());
        insert into public.beans(id,user_id,name,roastery,note,bean_type,process_method,roast_level,place_type,overall_score)
        values ('{BEAN}','{USER}','Concurrent blend','Fixture','Note','blend','washed','light','home',8);
        insert into public.blend_components(bean_id,user_id,origin_country,percentage) values ('{BEAN}','{USER}','Initial',100);
        commit;""")
        version = json.loads(execute(f"select to_json(updated_at) from public.beans where id='{BEAN}';"))
        bean = json.dumps({"name": "Replaced blend", "roastery": "Fixture", "note": "Replaced note", "bean_type": "blend", "process_method": "washed", "roast_level": "light", "place_type": "home", "overall_score": 8, "consumed_at": "2026-01-01T00:00:00Z", "expected_updated_at": version})
        components = '[{"origin_country":"First","percentage":33.33},{"origin_country":"Second","percentage":66.67}]'
        auth = f"select set_config('request.jwt.claim.sub','{USER}',true),set_config('request.jwt.claims','{claims}',true); set local role beanmap_api_runtime;"
        mutation = f"select public.update_bean_record('{BEAN}','{bean}','[]','{components}');"
        first = subprocess.Popen(COMMAND, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        first.stdin.write(f"begin; {auth} {mutation} select 'LOCKED';\n")
        first.stdin.flush()
        while first.stdout.readline().strip() != "LOCKED":
            if first.poll() is not None:
                raise AssertionError("First blend replacement failed")
        second = subprocess.Popen(COMMAND, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        second.stdin.write(f"set application_name='beanmap-collection-second'; begin isolation level {isolation}; {auth} select 'SNAPSHOT'; {mutation} commit;\n")
        second.stdin.close()
        second.stdin = None
        while second.stdout.readline().strip() != "SNAPSHOT":
            if second.poll() is not None:
                raise AssertionError("Second blend session failed")
        deadline = time.monotonic() + 10
        while execute("select exists(select 1 from pg_stat_activity where application_name='beanmap-collection-second' and wait_event_type='Lock');") != "t":
            if time.monotonic() >= deadline:
                raise AssertionError("Competing blend replacements did not serialize")
            time.sleep(0.05)
        first.stdin.write("commit;\n")
        first.stdin.close()
        first.stdin = None
        _, first_error = first.communicate(timeout=10)
        _, second_error = second.communicate(timeout=10)
        if first.returncode or not second.returncode or expected_code not in second_error:
            raise AssertionError(f"Unexpected replacement outcome: {first_error} {second_error}")
        if execute(f"select count(*)||':'||sum(percentage) from public.blend_components where bean_id='{BEAN}';") != "2:100.00":
            raise AssertionError("Concurrent replacements corrupted stored component totals")
        print(f"PASS blend replacement {isolation}: second edit rejected with {expected_code}")
    finally:
        for process in [first, second]:
            if process and process.poll() is None:
                process.terminate()
                process.wait(timeout=10)
        cleanup()
