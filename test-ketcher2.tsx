import React from 'react';
import { StandaloneStructServiceProvider } from 'ketcher-standalone';

const service = new StandaloneStructServiceProvider();
console.log(Object.keys(service));
