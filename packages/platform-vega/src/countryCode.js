import {bootData} from './bridge';

// The boot data carries a country only when the shell supplies one.
export const getCountryCode = async () => bootData()?.country || null;
