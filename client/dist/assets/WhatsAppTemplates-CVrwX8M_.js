import{j as e}from"./vendor-ui-CWNJASLM.js";import{D as a}from"./DashboardLayout-BgDKkyFU.js";import{B as r}from"./badge-BhHsLoyz.js";import{C as o,a as i,b as d,c as n,d as l}from"./card-aGJPAVQC.js";import{M as m}from"./message-square-DAZWGSTs.js";import{c as s}from"./index-DD_RDmYl.js";import{L as c}from"./dialog-Dg6DspvQ.js";import{S as p}from"./search-CoLXXWnL.js";import{C as u}from"./circle-check-LzWFZvDU.js";import"./vendor-react-C0JBPLdk.js";import"./button-BVGn1FYM.js";import"./house-C3KE4tJp.js";import"./user-fLgjYzAz.js";import"./TaskBuddyModal-Duk8xWrp.js";import"./input-SAO8gcHS.js";import"./plus-pfWRqoEH.js";import"./vendor-date-CpjWz490.js";import"./vendor-charts-CsKLJoxZ.js";import"./file-text-CfizpImX.js";import"./mail-7ve4ZRi-.js";import"./share-2-BEbwn1Bk.js";import"./check-DTx-i9E5.js";import"./shield-ZiMTUOXL.js";import"./vendor-socket-CyTcV1HU.js";import"./background-xZyzzsJy.js";import"./bell-CreiVdME.js";import"./database-FKFxmT7m.js";import"./users-Bx_BNfX4.js";import"./vendor-query-BcdYFBWE.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=s("CirclePlay",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["polygon",{points:"10 8 16 12 10 16 10 8",key:"1cimsy"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=s("Key",[["path",{d:"m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4",key:"g0fldk"}],["path",{d:"m21 2-9.6 9.6",key:"1j0ho8"}],["circle",{cx:"7.5",cy:"15.5",r:"5.5",key:"yqb3hr"}]]),b=[{id:"task_submitted",name:"Task Submitted",icon:m,color:"bg-blue-500",content:`Hello {{requester_name}},

Your task request has been successfully submitted.

 Task ID: {{task_id}}
Title: {{task_title}}
Status: Submitted
Deadline: {{deadline}}

Our team will review your request and keep you updated through the dashboard.

– SMVEC DesignDesk`},{id:"task_started",name:"Task Started",icon:h,color:"bg-green-500",content:`Hello {{requester_name}},

Good news! Your task has been started by our design team.

Task ID: {{task_id}}
Title: {{task_title}}
Status: Started

We’ll keep you informed as progress continues.

– SMVEC DesignDesk`},{id:"task_in_progress",name:"Task In Progress",icon:c,color:"bg-amber-500",content:`Hello {{requester_name}},

Your task is currently in progress 

Task ID: {{task_id}}
Title: {{task_title}}
Status: In Progress

Design work is actively underway.  
You can track updates anytime from your dashboard.

– SMVEC DesignDesk`},{id:"task_submitted_for_review",name:"Task Submitted for Review",icon:p,color:"bg-purple-500",content:`Hello {{requester_name}},

An update has been submitted for your task.

Task ID: {{task_id}}
Title: {{task_title}}
Status: Submitted for Review

Please review the update in your dashboard and share feedback if required.

– SMVEC DesignDesk`},{id:"task_final_files_uploaded",name:"Final Files Uploaded",icon:u,color:"bg-emerald-500",content:`Hello {{requester_name}},

Your task has been completed and final files are uploaded 

Task ID: {{task_id}}
Title: {{task_title}}
Status: Completed

You can download the final files from your dashboard.

Thank you for working with us,  
SMVEC DesignDesk`},{id:"forgot_password_otp",name:"Forgot Password – OTP",icon:k,color:"bg-slate-700",content:`Hello {{user_name}},

Your One-Time Password (OTP) to reset your password is:

OTP: {{otp_code}}

This OTP is valid for {{expiry_minutes}} minutes.  
Please do not share this code with anyone.

– SMVEC Support Team`}];function G(){return e.jsx(a,{children:e.jsxs("div",{className:"space-y-6 max-w-5xl",children:[e.jsxs("div",{className:"animate-fade-in",children:[e.jsx("h1",{className:"text-2xl font-bold text-foreground premium-headline",children:"WhatsApp Templates"}),e.jsx("p",{className:"text-muted-foreground mt-1 premium-body",children:"Official messaging templates for the SMVEC DesignDesk workflow"})]}),e.jsx("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-6 pb-12",children:b.map((t,g)=>e.jsxs(o,{className:"overflow-hidden border-border/70 shadow-sm hover:shadow-md transition-shadow animate-slide-up",style:{animationDelay:"${index * 100}ms"},children:[e.jsxs(i,{className:"pb-3 space-y-1",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx("div",{className:"p-2 rounded-lg ${template.color} text-white",children:e.jsx(t.icon,{className:"h-5 w-5"})}),e.jsx(r,{variant:"outline",className:"text-[10px] uppercase font-mono tracking-tighter",children:t.id})]}),e.jsx(d,{className:"text-xl mt-2",children:t.name}),e.jsx(n,{children:"Sent automatically on lifecycle events"})]}),e.jsx(l,{children:e.jsxs("div",{className:"bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-border/40 font-mono text-sm whitespace-pre-wrap leading-relaxed relative group",children:[e.jsx("div",{className:"absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 px-2 py-1 rounded text-[10px] font-bold text-slate-400 border border-border shadow-sm pointer-events-none",children:"PREVIEW"}),t.content]})})]},t.id))})]})})}export{G as default};
