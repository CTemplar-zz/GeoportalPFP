import { defineConfig } from '@playwright/test';
const port=process.env.PFP_TEST_PORT||'4175';
const baseURL=`http://localhost:${port}`;
export default defineConfig({testDir:'tests',timeout:90000,workers:1,reporter:'list',webServer:{command:'npm run dev',url:baseURL,env:{PORT:port},reuseExistingServer:false},use:{baseURL,viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,screenshot:'only-on-failure',trace:'retain-on-failure'},projects:[{name:'webkit',use:{browserName:'webkit'}}]});
