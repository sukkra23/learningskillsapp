/** Python side of the test harness; defines __orbit_run(code, entry, tests_json) -> JSON string. */
export const PY_HARNESS = `
import io, json, sys, traceback

def __orbit_short_tb():
    lines = traceback.format_exc().strip().split("\\n")
    for i, line in enumerate(lines):
        if 'File "main.py"' in line:
            return "\\n".join(lines[i:])
    return lines[-1]

def __orbit_run(code, entry, tests_json):
    result = {"stdout": "", "error": None, "tests": []}
    out = io.StringIO()
    old = sys.stdout
    sys.stdout = out
    try:
        ns = {"__name__": "__main__"}
        exec(compile(code, "main.py", "exec"), ns)
        if entry:
            fn = ns.get(entry)
            if not callable(fn):
                raise NameError("Define a function named " + entry + ".")
            for args in json.loads(tests_json):
                try:
                    got = fn(*args)
                    try:
                        result["tests"].append({"ok": True, "got": json.loads(json.dumps(got))})
                    except TypeError:
                        result["tests"].append({"ok": False, "error": "Returned a value that cannot be compared: " + repr(got)})
                except Exception as e:
                    result["tests"].append({"ok": False, "error": type(e).__name__ + ": " + str(e)})
    except BaseException:
        result["error"] = __orbit_short_tb()
    finally:
        sys.stdout = old
    result["stdout"] = out.getvalue()
    return json.dumps(result)
`;
