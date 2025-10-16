export const getBrowserName = () => {
    const ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return "Edge";
    if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Chrome";
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
    if (/Firefox\//.test(ua)) return "Firefox";
    return "Unknown";
  };
  
  export const getOS = () => {
    const p = (navigator.userAgentData?.platform || navigator.platform || "").toLowerCase();
    if (p.includes("win")) return "Windows";
    if (p.includes("mac")) return "macOS";
    if (p.includes("iphone") || p.includes("ipad") || p.includes("ios")) return "iOS";
    if (p.includes("android")) return "Android";
    return "Other";
  };
  
  export const getDeviceType = () => {
    const ua = navigator.userAgent.toLowerCase();
    if (/mobile|iphone|ipod|android.+mobile/.test(ua)) return "Phone";
    if (/ipad|tablet|android(?!.*mobile)/.test(ua)) return "Tablet";
    return "Desktop";
  };
  
  export const getSessionKey = () => {
    const os = getOS();
    const browser = getBrowserName();
    const deviceType = getDeviceType();
    return `${os}::${browser}::${deviceType}`;
  };
  
  export const getDeviceName = () => `${getBrowserName()} on ${getOS()}`;
  