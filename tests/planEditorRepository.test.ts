import test from "node:test";
import assert from "node:assert/strict";
import { createPlanEditorRepository, planDraftKey } from "../src/features/plans/planEditorRepository";
import type { PlanEditorDraft } from "../src/features/plans/planEditorModel";

test("Plan drafts survive adapter restart, isolate accounts/modes and commit chunks atomically",async()=>{
 const values=new Map<string,string>();let fail=false;
 const io={read:async(k:string)=>values.get(k)??null,write:async(k:string,v:string)=>{if(fail)throw new Error("Storage full");values.set(k,v);},remove:async(k:string)=>{values.delete(k);}};
 const repo=createPlanEditorRepository(io),key=planDraftKey("alice",false,"draft");
 const draft:PlanEditorDraft={version:1,token:"draft",revision:0,title:"A long draft",description:"🌟".repeat(1200),timezone:"UTC",start_date:"",squad_id:null,removed_stop_ids:[],stops:[]};
 await repo.writePlanDraft(key,draft);
 assert.deepEqual(await createPlanEditorRepository(io).readPlanDraft(key),draft);
 assert.equal(await repo.readPlanDraft(planDraftKey("bob",false,"draft")),null);
 assert.equal(await repo.readPlanDraft(planDraftKey("alice",true,"draft")),null);
 fail=true;await assert.rejects(repo.writePlanDraft(key,{...draft,title:"Unsaved local edit"}),/Storage full/);fail=false;
 assert.equal((await createPlanEditorRepository(io).readPlanDraft(key))?.title,"A long draft");
 await repo.writePlanDraft(key,{...draft,title:"Recovered"});
 await repo.deletePlanDraft(key);assert.equal(await repo.readPlanDraft(key),null);
});
