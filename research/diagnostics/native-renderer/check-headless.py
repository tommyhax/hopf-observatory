"""Build without SDL and compare a frame to the validated SDL-enabled build."""
from pathlib import Path
import json,subprocess,tempfile,hashlib
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
capture=json.loads((HERE/'results/captures.json').read_text())
reference=next(x for x in capture['measurements'] if x['scene']==0 and x['width']==480 and x['mode']==0)
with tempfile.TemporaryDirectory(prefix='hopf-native-headless-') as directory:
    build=Path(directory)
    configure=['cmake','-S',str(ROOT/'native'),'-B',str(build),'-DCMAKE_BUILD_TYPE=Release',
        '-DCMAKE_PREFIX_PATH=/opt/homebrew','-DCMAKE_DISABLE_FIND_PACKAGE_SDL3=TRUE']
    log=subprocess.check_output(configure,text=True,stderr=subprocess.STDOUT)
    log+=subprocess.check_output(['cmake','--build',str(build),'-j','4'],text=True,stderr=subprocess.STDOUT)
    process=subprocess.Popen([str(build/'hopf-render'),'--threads','2'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True)
    metadata=json.loads(process.stdout.readline());assert metadata['sdl'] is False
    request=dict(op='render',uniforms=reference['uniforms'],width=480,height=270,frames=1)
    process.stdin.write(json.dumps(request)+'\n');process.stdin.flush();result=json.loads(process.stdout.readline())
    process.stdin.close();assert process.wait()==0
    assert result['checksum']==reference['native']['checksum']
    assert result['invalidRoots']==result['invalidPixels']==0
    report=dict(passed=True,metadata=metadata,result=result,configure=configure,buildLog=log,
        generatedOpticsSHA256=hashlib.sha256((build/'generated/optics.inc').read_bytes()).hexdigest())
(HERE/'results/headless-build.json').write_text(json.dumps(report,indent=2)+'\n')
print('Headless CMake build passed; two-worker frame is byte-identical to the SDL-enabled capture.')
