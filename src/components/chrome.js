// Sign-in screens are a dead end for the tabs (most of them would bounce
// straight back to login), so the navigation stays out of the way there.
const HIDDEN_ON = ['/login', '/register', '/reset-password'];

export const isChromeHidden = (pathname) => HIDDEN_ON.includes(pathname);
