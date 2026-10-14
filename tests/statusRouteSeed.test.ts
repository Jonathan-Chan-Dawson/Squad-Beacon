import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, DEMO_ID, demoAction } from "../src/shared/demo";
import { legacyStatusSeed, usesSharedStatusEditor } from "../src/features/beacons/statusRouteSeed";
const now = Date.now();

test("legacy status routing shares the editor while template editing remains canonical", () => {
  assert.equal(usesSharedStatusEditor({kind:"status"}),true);
  assert.equal(usesSharedStatusEditor({kind:"status",saveTemplate:"yes"}),false);
  assert.equal(usesSharedStatusEditor({kind:"status",editTemplate:"yes"}),false);
  assert.equal(usesSharedStatusEditor({kind:"beacon",statusSourceId:"source"}),false);
});
test("legacy seeds retain authorized text, audience, dates and explicit finite coordinates", () => {
  const data=makeDemo();
  const source={...data.activities[0],id:"status-source",owner_id:DEMO_ID,mode:"solo" as const,audience:"private" as const,audience_id:null,title:"Book practice",description:"French",category:"Study" as const};
  data.activities=[source]; data.places=[{activity_id:source.id,label:"Desk",latitude:40,longitude:-90,online_url:null}];
  const seed=legacyStatusSeed(data,DEMO_ID,{kind:"status",repeat:source.id,startsAt:new Date(now+86400000).toISOString(),timezone:"America/Chicago",latitude:"41.25",longitude:"-91.5",placeLabel:"Confirmed pin"},now);
  assert.equal(seed.title,source.title); assert.equal(seed.description,source.description); assert.equal(seed.category,source.category); assert.equal(seed.audience,"private");
  assert.equal(seed.sourceId,source.id); assert.equal(seed.startsAt,new Date(now+86400000).toISOString()); assert.equal(seed.latitude,41.25); assert.equal(seed.label,"Confirmed pin");
  assert.throws(()=>legacyStatusSeed(data,DEMO_ID,{startsAt:"bad"},now),/start time/);
  assert.throws(()=>legacyStatusSeed(data,DEMO_ID,{timezone:"bad/zone"},now),/timezone/);
  assert.throws(()=>legacyStatusSeed(data,DEMO_ID,{latitude:"",longitude:"0"},now),/meeting point/);
  assert.throws(()=>legacyStatusSeed(data,DEMO_ID,{inviteeIds:'["jordan"]'},now),/selected friends/);
  assert.throws(()=>legacyStatusSeed(data,"jordan",{},now),/Refresh/);
});
test("readable unapproved source text never copies private meeting or profile coordinates", () => {
  const data=makeDemo();
  const source={...data.activities[0],id:"restricted-place",owner_id:"jordan",mode:"squad" as const,audience:"friends" as const,audience_id:null,approval_required:true,title:"Readable title"};
  data.activities=[source]; data.rsvps=[]; data.places=[{activity_id:source.id,label:"Protected",latitude:40,longitude:-90,online_url:"https://example.com/private"}];
  const seed=legacyStatusSeed(data,DEMO_ID,{repeat:source.id},now);
  assert.equal(seed.title,source.title); assert.equal(seed.latitude,null); assert.equal(seed.longitude,null); assert.equal(seed.label,""); assert.equal(seed.onlineUrl,null); assert.equal(seed.sourceId,undefined);
  data.blocks.push({blocker_id:DEMO_ID,blocked_id:"jordan"});
  assert.throws(()=>legacyStatusSeed(data,DEMO_ID,{repeat:source.id},now),/unavailable/);
});
test("demo status edits preserve ID and reactions, failures roll back, future and clear scopes remain separate", () => {
  let data=makeDemo();
  const source={...data.activities[0],id:"atomic-status",owner_id:DEMO_ID,mode:"solo" as const,audience:"friends" as const,audience_id:null,status:"scheduled" as const,
    starts_at:new Date(now-60000).toISOString(),ends_at:new Date(now+3600000).toISOString(),available:true,enable_reactions:true};
  data.activities=[source]; data.places=[{activity_id:source.id,label:"Desk",latitude:40,longitude:-90,online_url:null}];
  data.reactions=[{activity_id:source.id,user_id:DEMO_ID,emoji:String.fromCodePoint(0x1f64c)}];
  const original=structuredClone(data);
  assert.throws(()=>demoAction(data,"save_status_note",{source_id:source.id,title:"",available:false}),/title|characters/i);
  assert.deepEqual(data,original);
  data=demoAction(data,"save_status_note",{source_id:source.id,title:"Updated note"});
  assert.equal(data.activities[0].id,source.id); assert.equal(data.reactions.length,1); assert.equal(data.places[0].latitude,40);
  data=demoAction(data,"save_status_note",{title:"Future",starts_at:new Date(now+86400000).toISOString(),ends_at:new Date(now+90000000).toISOString()});
  assert.equal(data.activities.find((item)=>item.id===source.id)?.status,"scheduled");
  data=demoAction(data,"clear_status_notes",{});
  assert.equal(data.activities.find((item)=>item.id===source.id)?.status,"cancelled");
  assert.equal(data.activities.find((item)=>item.title==="Future")?.status,"scheduled");
  assert.equal(data.reactions.length,1,"history remains retained");
});

test("owned template status seeds retain title, description, category, label and duration", () => {
  const data=makeDemo();
  const template={...data.templates[0],id:"status-template",owner_id:DEMO_ID,title:"Template note",description:"Template details",category:"Creative" as const,label:"Studio",minutes:90};
  data.templates=[template];
  const seed=legacyStatusSeed(data,DEMO_ID,{template:template.id},now);
  assert.equal(seed.title,template.title); assert.equal(seed.description,template.description); assert.equal(seed.category,template.category); assert.equal(seed.label,"Studio");
  assert.equal(Date.parse(seed.endsAt)-Date.parse(seed.startsAt!),90*60000);
  data.templates=[{...template,owner_id:"jordan"}];
  assert.throws(()=>legacyStatusSeed(data,DEMO_ID,{template:template.id},now),/unavailable/);
});
