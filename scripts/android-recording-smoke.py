"""Exercise a signed APK on an isolated Android emulator and retain native logs.

Only synthetic coordinates are sent. This script clears emulator app data;
it must never be pointed at a personal device.
"""
import pathlib
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
import uiautomator2 as u2

PACKAGE = "com.apexmoto.app"
OUT = pathlib.Path("test-results/android")
OUT.mkdir(parents=True, exist_ok=True)
device = None


def adb(*args, check=True, timeout=40):
    return subprocess.run(["adb", "-e", *args], check=check, capture_output=True,
                          text=True, timeout=timeout).stdout.strip()


def snapshot(name):
    # The live ride timer prevents the shell dumper's wait-for-idle condition.
    # UiAutomator2 reads the current hierarchy with that wait disabled.
    xml = ""
    for attempt in range(4):
        try:
            xml = device.dump_hierarchy(compressed=False, pretty=False)
        except Exception as error:
            (OUT / f"{name}-dump-{attempt}.txt").write_text(str(error))
        if xml.startswith("<?xml"):
            break
        time.sleep(2)
    assert xml.startswith("<?xml"), f"UI dump failed for {name}"
    (OUT / f"{name}.xml").write_text(xml)
    image = subprocess.run(["adb", "-e", "exec-out", "screencap", "-p"],
                           capture_output=True, timeout=30).stdout
    (OUT / f"{name}.png").write_bytes(image)
    return ET.fromstring(xml)


def tap_label(label, name, scroll=False, activate=True):
    for attempt in range(8 if scroll else 3):
        root = snapshot(f"{name}-{attempt}")
        # Android's hierarchy can include app controls occluded by the IME.
        # Their bounds are not valid tap targets until they are scrolled above it.
        keyboard_tops = []
        for node in root.iter("node"):
            if ".inputmethod." in node.get("package", ""):
                rect = list(map(int, re.findall(r"\d+", node.get("bounds", ""))))
                if len(rect) == 4 and rect[3] > rect[1]:
                    keyboard_tops.append(rect[1])
        visible_bottom = min(keyboard_tops) if keyboard_tops else device.window_size()[1]
        for node in root.iter("node"):
            if node.get("package") == PACKAGE and label in (node.get("text", ""), node.get("content-desc", "")):
                nums = list(map(int, re.findall(r"\d+", node.get("bounds", ""))))
                if len(nums) == 4 and nums[3] > nums[1] and nums[3] <= visible_bottom:
                    if not activate:
                        return
                    adb("shell", "input", "tap", str((nums[0] + nums[2]) // 2),
                        str((nums[1] + nums[3]) // 2))
                    time.sleep(1)
                    return
        if scroll:
            container = next((n for n in root.iter("node")
                              if n.get("scrollable") == "true"
                              and n.get("package") == PACKAGE), None)
            assert container is not None, "No scrollable app content found"
            left, top, right, bottom = map(int, re.findall(r"\d+", container.get("bounds", "")))
            bottom = min(bottom, visible_bottom)
            assert bottom > top + 80, "No visible scroll area above keyboard"
            # Scroll the page gutter; a swipe over a native map pans the map.
            # Dialogs also reserve content padding here, away from text inputs.
            x = str(left + 8)
            adb("shell", "input", "swipe", x, str(bottom - 45), x, str(top + 45), "450")
        time.sleep(1)
    raise AssertionError(f"Could not find {label!r}; inspect {name} screenshots")


def assert_alive():
    assert adb("shell", "pidof", PACKAGE, check=False), "App process died; inspect logcat"


def permissions():
    for attempt in range(12):
        root = snapshot(f"permission-{attempt}")
        nodes = list(root.iter("node"))
        target = next((n for n in nodes if n.get("resource-id", "").endswith(
            "permission_allow_foreground_only_button")), None)
        if target is None:
            target = next((n for n in nodes if n.get("text") in (
                "Allow all the time", "While using the app", "Allow")), None)
        if target is not None:
            nums = list(map(int, re.findall(r"\d+", target.get("bounds", ""))))
            adb("shell", "input", "tap", str((nums[0]+nums[2])//2), str((nums[1]+nums[3])//2))
            if target.get("text") == "Allow all the time":
                adb("shell", "input", "keyevent", "4")
            # Let the system permission dialog dismiss on slow software renderers.
            time.sleep(5)
        elif any(n.get("package") == PACKAGE for n in nodes):
            assert_alive()
            return
        time.sleep(2)
    raise AssertionError("Permission flow did not return to Apex Moto")


log = None
try:
    assert adb("shell", "getprop", "ro.kernel.qemu") == "1", "Emulator required"
    adb("install", "-r", sys.argv[1], timeout=180)
    adb("shell", "pm", "clear", PACKAGE)
    device = u2.connect(adb("get-serialno"))
    device.jsonrpc.setConfigurator({"waitForIdleTimeout": 0, "waitForSelectorTimeout": 0})
    adb("logcat", "-c")
    log_file = (OUT / "logcat.txt").open("w")
    log = subprocess.Popen(["adb", "-e", "logcat", "-v", "threadtime"], stdout=log_file)
    adb("emu", "geo", "fix", "73.8567", "18.5204", "560", "8")
    adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "apexmoto://record", PACKAGE)
    time.sleep(8)
    assert_alive()
    tap_label("Start recording", "start", scroll=True)
    tap_label("Start with GPS", "start-gps")
    permissions()
    for i in range(12):
        adb("emu", "geo", "fix", str(73.8567 + i * 0.00012), "18.5204", "560", "8")
        time.sleep(2)
        assert_alive()
    root = snapshot("recording")
    assert any("Pause" == n.get("content-desc") or "Pause" == n.get("text")
               for n in root.iter("node")), "Recording controls were not shown"
    (OUT / "services.txt").write_text(adb("shell", "dumpsys", "activity", "services", PACKAGE))
    adb("shell", "input", "keyevent", "3")
    time.sleep(10)
    assert_alive()
    adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "apexmoto://record", PACKAGE)
    time.sleep(3)
    tap_label("Pause", "pause", scroll=True)
    tap_label("Resume", "resume", scroll=True)
    time.sleep(3)
    assert_alive()
    tap_label("Finish ride", "finish", scroll=True)
    tap_label("Save ride", "save")
    time.sleep(5)
    assert_alive()
    saved = snapshot("saved")
    assert any(n.get("text") in ("YOUR SAVED RIDE", "YOUR RIDE, REMEMBERED")
               for n in saved.iter("node")), "Saved ride detail did not open"
    tap_label("Edit ride", "edit-ride", scroll=True)
    inputs = device(className="android.widget.EditText")
    assert inputs.count >= 2, "Ride edit fields missing"
    inputs[0].click()
    time.sleep(2)  # Wait for native keyboard + modal resize before setting text.
    inputs[0].set_text("Native QA ride")
    snapshot("edit-keyboard-open")
    tap_label("Save changes", "save-edited-ride", scroll=True)
    edited = snapshot("edited-ride")
    assert not any(n.get("text") == "Make this ride yours." for n in edited.iter("node")), "First Save tap only dismissed keyboard"
    assert any(n.get("text") == "Native QA ride" for n in edited.iter("node")), "Edited name was not saved"
    tap_label("Favourite ride", "favourite", scroll=True)
    tap_label("1×", "replay-rate", scroll=True)
    replay = snapshot("replay-rate-2x")
    assert any(n.get("text") == "2×" for n in replay.iter("node")), "Replay did not start at 1x"
    # Simulate OS process loss after a saved ride, then a launcher return.
    # This checks recovery; it does not claim to reproduce the Realme Maps fault.
    adb("shell", "am", "force-stop", PACKAGE)
    adb("shell", "monkey", "-p", PACKAGE, "-c", "android.intent.category.LAUNCHER", "1")
    time.sleep(8)
    assert_alive()
    restored = snapshot("restored-last-screen")
    assert any(n.get("text") == "Native QA ride" for n in restored.iter("node")), "Launcher return lost saved ride context"
    # Settings and summary are checked in the same signed native build.
    adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "apexmoto://settings", PACKAGE)
    time.sleep(3)
    tap_label("Imperial units", "imperial", scroll=True)
    imperial = snapshot("imperial-selected")
    imperial_bounds = next(n.get("bounds") for n in imperial.iter("node") if n.get("content-desc") == "Imperial units")
    tap_label("Metric units", "metric")
    metric = snapshot("metric-selected")
    assert next(n.get("bounds") for n in metric.iter("node") if n.get("content-desc") == "Imperial units") == imperial_bounds, "Units toggle changed card bounds"
    adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "apexmoto:///", PACKAGE)
    time.sleep(3)
    tap_label("All time", "all-time", scroll=True)
    all_time = snapshot("all-time-selected")
    assert any("Totals from every ride saved" in n.get("text", "") for n in all_time.iter("node")), "Period explanation missing"
    tap_label("This week", "this-week")
    snapshot("week-selected")
    adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "apexmoto://explore", PACKAGE)
    time.sleep(3)
    tap_label("View ride & route", "scroll-personal-road", scroll=True, activate=False)
    roads = snapshot("personal-roads")
    text = " ".join(n.get("text", "") for n in roads.iter("node"))
    assert "Recorded by you" in text, "Saved GPS ride missing from Explore"
    assert not any(sample in text for sample in ("Lavasa", "Mulshi", "Panshet")), "Sample catalogue remains"
    crashes = adb("logcat", "-b", "crash", "-d", check=False)
    assert PACKAGE not in crashes, "Native crash recorded even though the process restarted"
    print("PASS: permission flow, GPS delivery, background survival, pause/resume, save, keyboard-first edit, favourite, replay rate, units bounds, summary periods, personal Explore")
finally:
    adb("logcat", "-b", "crash", "-d", check=False)
    (OUT / "crash.txt").write_text(adb("logcat", "-b", "crash", "-d", check=False))
    if log:
        log.terminate()
