import { mount } from 'svelte';
import { RAIL_WIDTH, TITLE_BAR_HEIGHT } from '../shared/chrome.ts';
import './tokens.css';
import App from './App.svelte';
import Overlay from './Overlay.svelte';

const target = document.getElementById('app');
if ( !target ) throw new Error('index.html has no #app');

// main lays the service views out from the same numbers
document.documentElement.style.setProperty('--rx-rail-width', RAIL_WIDTH + 'px');
document.documentElement.style.setProperty('--rx-titlebar-height', TITLE_BAR_HEIGHT + 'px');

// The same page draws the dialogs in the view main puts over the services.
const isOverlay = location.hash === '#overlay';
document.documentElement.classList.toggle('overlay', isOverlay);
mount(isOverlay ? Overlay : App, { target });
