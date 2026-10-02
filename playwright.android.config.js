import { defineConfig } from '@playwright/test';
import config from './playwright.config.js';
export default defineConfig({...config,projects:[{name:'chromium-android',use:{browserName:'chromium'}}]});
