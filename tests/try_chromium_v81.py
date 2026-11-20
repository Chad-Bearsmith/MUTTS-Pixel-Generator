"""Best-effort headless Chromium Unity startup; not an interactive acceptance test."""
import os,re,subprocess,time,json
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
exe=root/'phm-linux-smoke-v81'
proc=subprocess.Popen([str(exe)],cwd=root,env={**os.environ,'PHM_DISABLE_BROWSER':'1'},stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
 msg=''
 for _ in range(10):
  line=proc.stdout.readline();msg+=line
  if 'http://' in line:break
 m=re.search(r'http://127\.0\.0\.1:\d+/',msg);assert m,msg
 url=m.group(0)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,timeout=30000,
    args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader'])
  page=browser.new_page(viewport={'width':1200,'height':940})
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  print('NAVIGATING',url,flush=True)
  try:
   page.goto(url,wait_until='domcontentloaded',timeout=16000)
   print('TITLE',page.title(),flush=True)
   page.wait_for_timeout(18000)
   print('STATUS',json.dumps(page.evaluate("""() => ({title:document.title,canvas:!!document.querySelector('#unity-canvas'),module:!!(window.gameInstance?.Module||window.PHMGameInstance?.Module),underlay:window.PHMV76LayerProvenance?.experimentalUnderlayStatus?.(),preview:window.PHMIdleFrame?.report?.(),errors:document.querySelector('#unity-warning')?.innerText})"""),default=str)[:3000],flush=True)
   print('PAGE_ERRORS',errors[:10])
   page.screenshot(path='/mnt/data/phm-v81-work/tests/v81-chromium-smoke.png')
  except Exception as e:print('NAVIGATION/STARTUP NOT TESTABLE:',str(e)[:500],flush=True)
  browser.close()
finally:
 proc.terminate()
 try:proc.wait(timeout=6)
 except subprocess.TimeoutExpired:proc.kill()
