import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
const base=process.argv[2]||'http://127.0.0.1:3000';
const id='75000000-0000-4000-8000-000000000001';
const profile={id,username:'muscle_fixture',email:'muscle@example.test',display_name:'Fixture Coach',role:'Admin',is_active:true,must_change_password:false};
const user={id,aud:'authenticated',role:'authenticated',aal:'aal2',email:profile.email,app_metadata:{provider:'email'},user_metadata:{}};
const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,role:'authenticated',aal:'aal2',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.fixture`;
const student={id:'STU-M-001',khmer_name:'Fixture',english_name:'Muscle Athlete',gender:'Male',dob:'2010-01-01',registration_date:'2025-01-01',scholarship_id:1,current_belt:'White',student_status:'Active',home_branch_id:1,student_addresses:[]};
const assets=[{id:1,title:'Front kick fixture',description:'Teaching fixture',library_type:'Taekwondo',tkd_category:'Kicking Basics',target_level:'White',created_at:'2026-01-01'}, {id:2,title:'Balance fixture',description:'Teaching fixture',library_type:'Taekwondo',tkd_category:'Kicking Basics',target_level:'White',created_at:'2026-01-01'}];
const datasets={students:[student],branches:[{id:1,branch_name:'Fixture Branch'}],scholarships:[{id:1,type_name:'Standard',discount_percentage:0}],library_assets:assets,muscles:[{id:1,name:'Quadriceps',muscle_group:'Legs',target_function:'Knee extension'},{id:2,name:'Hamstrings',muscle_group:'Legs',target_function:'Knee flexion'}],library_asset_muscles:[{asset_id:1,muscle_id:1,role:'Primary'},{asset_id:1,muscle_id:2,role:'Secondary'},{asset_id:2,muscle_id:1,role:'Primary'}],lms_progress:[{id:1,student_id:student.id,curriculum_id:1,status:'Completed',last_watched_at:'2026-10-01T00:00:00Z'}]};
const errors=[];const modelRequests=[];let failModels=false;let page;const measurements=[];
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
try{
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}});
 await context.routeWebSocket('**/realtime/v1/websocket*',socket=>socket.close());
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.origin===new URL(base).origin){
   if(url.pathname.startsWith('/models/')){modelRequests.push(url.pathname);if(failModels)return route.fulfill({status:503,body:'Fixture model unavailable'});return route.continue();}
   if(url.pathname==='/api/auth/login')return json({success:true,data:{access_token:token,refresh_token:'fixture-refresh'}});
   if(url.pathname.startsWith('/api/'))return json({success:true,data:[]});
   return route.continue();
  }
  if(url.pathname==='/auth/v1/user')return json(user);
  if(url.pathname==='/auth/v1/token')return json({user,access_token:token,refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer'});
  if(url.pathname.startsWith('/rest/v1/')){
   assert.equal(route.request().method(),'GET','anatomy must never write database records');
   const table=url.pathname.split('/').pop();
   if(table==='profiles')return json(url.searchParams.has('id')?profile:[profile]);
   if(table==='academy_profile')return json({id:'default',academy_name:'Fixture Academy'});
   return json(datasets[table]||[]);
  }
  return route.abort();
 });
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base,{waitUntil:'networkidle',timeout:120000});await page.locator('#login-identifier').fill('muscle_fixture');await page.locator('#login-password').fill('Fictional-Password');await page.locator('button[type=submit]').click();await page.waitForURL('**/dashboard');
 await page.goto(base+'/students',{waitUntil:'networkidle',timeout:120000});await page.getByRole('row').filter({hasText:'Muscle Athlete'}).click();await page.getByRole('button',{name:'Biometrics & Dev',exact:true}).click();
 await page.getByRole('button',{name:'Open student muscle explorer',exact:true}).waitFor();assert.equal(modelRequests.length,0,'student preview does not download 3D assets');
 const started=Date.now();await page.getByRole('button',{name:'Open student muscle explorer',exact:true}).click();
 let studio=page.getByTestId('anatomy-studio');await studio.waitFor();
 // Load the real compact geometry; only database and authentication services are mocked.
 await studio.locator('.scene canvas').waitFor({timeout:120000});
 await studio.getByText('Preparing muscle view',{exact:false}).waitFor({state:'hidden',timeout:120000});
 measurements.push({coldOpenMs:Date.now()-started,requestedGeometry:modelRequests.filter(url=>url.includes('.bin'))});
 assert.equal(await page.locator('.scene canvas').count(),1,'one WebGL scene is mounted');
 assert.ok(modelRequests.every(url=>url.startsWith('/models/training/compact/')),'default does not request the original full atlas');
 assert.ok(modelRequests.filter(url=>url.includes('.bin')).every(url=>url.includes('muscular-')),'unused layers are not downloaded');
 await page.waitForTimeout(1000);
 const scene=studio.locator('.scene');
 const settled=await scene.getAttribute('data-render-frames');
 await page.waitForTimeout(500);
 assert.equal(await scene.getAttribute('data-render-frames'),settled,'idle model schedules no continuing render frames');
 assert.ok(Number(await scene.getAttribute('data-render-triangles'))<450000,'default view draws the compact muscle budget');
 measurements.push({idleFrames:Number(settled),drawnTriangles:Number(await scene.getAttribute('data-render-triangles')),drawCalls:Number(await scene.getAttribute('data-draw-calls'))});
 await page.screenshot({path:'scratch/anatomy-overview.png'});
 await studio.getByRole('button',{name:'Quadriceps',exact:true}).first().click();
 await studio.getByRole('heading',{name:'Quadriceps',exact:true}).waitFor();await studio.getByRole('button',{name:'Isolate',exact:true}).click();
 await studio.getByRole('button',{name:'Back',exact:true}).click();
 await studio.getByRole('button',{name:'About the anatomy reference',exact:true}).click();await studio.getByText('Adult male anatomy reference.',{exact:false}).waitFor();
 await studio.getByRole('button',{name:'About the anatomy reference',exact:true}).click();
 for(const size of [{width:1440,height:1000},{width:834,height:1112},{width:390,height:844}]){
  await page.setViewportSize(size);await page.waitForTimeout(150);
  assert.ok(await studio.evaluate(element=>element.scrollWidth<=element.clientWidth+1),'no studio horizontal overflow at '+size.width);
  const close=studio.getByRole('button',{name:'Close muscle explorer',exact:true});await close.focus();await page.keyboard.press('Shift+Tab');assert.ok(await studio.evaluate(element=>element.contains(document.activeElement)),'focus stays in studio');
  await page.screenshot({path:`scratch/anatomy-${size.width}.png`});
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.keyboard.press('Escape');await studio.waitFor({state:'hidden'});assert.equal(await page.locator('.scene canvas').count(),0);
 for(let n=0;n<10;n++){await page.getByRole('button',{name:'Open student muscle explorer',exact:true}).click();await studio.locator('.scene canvas').waitFor({timeout:120000});await page.keyboard.press('Escape');await studio.waitFor({state:'hidden'});assert.equal(await page.locator('.scene canvas').count(),0);}
 await page.goto(base+'/library?material=1',{waitUntil:'networkidle',timeout:120000});await page.getByText('Front kick fixture',{exact:true}).last().waitFor();
 assert.equal(await page.locator('.scene canvas').count(),0,'library material preview defaults to 2D');
 await page.getByTitle('View Fullscreen',{exact:true}).click();await studio.waitFor();await studio.locator('.scene canvas').waitFor({timeout:120000});
 await studio.getByRole('button',{name:'Quadriceps',exact:true}).first().click();
 await studio.getByRole('button',{name:/Balance fixture.*Primary/}).click();await studio.waitFor({state:'hidden'});
 await page.getByRole('heading',{name:'Balance fixture',exact:true}).last().waitFor();
 // A learning-page button which formerly did nothing must now open its shared studio.
 await page.goto(base+'/lms',{waitUntil:'networkidle',timeout:120000});
 const open=page.getByRole('button',{name:/3D Studio|3D Anatomy|Muscle explorer/i}).first();await open.click();await studio.waitFor();await studio.locator('.scene canvas').waitFor({timeout:120000});
 await studio.locator('.scene canvas').evaluate(canvas=>canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
 await studio.getByRole('button',{name:'Retry 3D',exact:true}).waitFor();assert.equal(await studio.locator('.scene canvas').count(),0);
 await studio.getByRole('button',{name:'Retry 3D',exact:true}).click();await studio.locator('.scene canvas').waitFor({timeout:120000});
 await studio.getByRole('button',{name:'Close muscle explorer',exact:true}).click();await studio.waitFor({state:'hidden'});
 // A model failure falls back locally and leaves navigation and data available.
 failModels=true;await page.reload({waitUntil:'networkidle'});await open.click();await studio.waitFor();await studio.getByRole('button',{name:'Retry 3D',exact:true}).waitFor({timeout:120000});assert.equal(await studio.locator('.scene canvas').count(),0);await studio.getByRole('button',{name:'Close muscle explorer',exact:true}).click();
 assert.deepEqual(errors,[]);
 fs.writeFileSync('scratch/anatomy-browser-results.json',JSON.stringify({measurements,modelRequests,errors},null,2));
 console.log('Anatomy browser checks passed: real compact geometry, saved training coverage, selection/isolation, one scene, disposal/reopen, responsive layouts, focus/Escape, library 2D preview, LMS modal and model-failure fallback. No live writes. '+JSON.stringify(measurements));
}catch(error){if(page){await page.screenshot({path:'scratch/anatomy-failure.png'}).catch(()=>{});console.error(JSON.stringify({url:page.url(),errors,body:(await page.locator('body').innerText()).slice(-3000)}));}throw error;}finally{await browser.close();}
