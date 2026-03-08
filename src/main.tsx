import { render } from 'preact';
import { App } from './app';
import './styles/reset.css';
import './styles/tokens.css';
import './styles/global.css';

render(<App />, document.getElementById('app')!);
