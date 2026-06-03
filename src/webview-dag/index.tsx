import React from 'react';
import { createRoot } from 'react-dom/client';
import DagApp from './DagApp';

const root = createRoot(document.getElementById('root')!);
root.render(<DagApp />);
