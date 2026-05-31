import { AvenxApp } from '../.avenx/runtime/index.js';
import Source from './components/source/source.component.js';
import Display from './components/display/display.component.js';

const app = new AvenxApp({ target: '#app' });

app.register('Source', Source);
app.register('Display', Display);

app.mount('Source', '#source');
app.mount('Display', '#display');
