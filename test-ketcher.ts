import { StandaloneStructServiceProvider } from "ketcher-standalone";
const provider = new StandaloneStructServiceProvider();
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(provider)));
