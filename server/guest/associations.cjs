function linkConfiguration(env) {
  let host=null;
  try { const u=new URL(env.EXPO_PUBLIC_GUEST_ORIGIN || env.SB_PUBLIC_ORIGIN || '');if(u.protocol==='https:' && u.pathname==='/' && !u.search && !u.hash && !u.username && !u.password)host=u.hostname; } catch { /* No invented domain. */ }
  if(env.EXPO_PUBLIC_GUEST_ORIGIN && env.SB_PUBLIC_ORIGIN) {try {if(new URL(env.EXPO_PUBLIC_GUEST_ORIGIN).origin!==new URL(env.SB_PUBLIC_ORIGIN).origin)host=null;} catch {host=null;} }
  const team=/^[A-Z0-9]{10}$/.test(env.APPLE_TEAM_ID || '') ? env.APPLE_TEAM_ID : null;
  const fingerprints=String(env.ANDROID_APP_LINK_FINGERPRINTS || '').split(',').map(x=>x.trim().toUpperCase()).filter(x=>/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(x));
  return {host,team,fingerprints,apple:host && team ? { applinks:{apps:[],details:[{appID:`${team}.com.squadbeacon.app`,paths:['/g/*']}]} } : null,
    android:host && fingerprints.length ? [{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:'com.squadbeacon.app',sha256_cert_fingerprints:fingerprints}}] : null};
}
module.exports={linkConfiguration};
