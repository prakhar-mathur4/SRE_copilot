# AGENT1: Project Prompts

## Prompt 1: Initial Setup
You are a Senior Site Reliability Engineer and DevOps Architect with expertise in Kubernetes, AWS EKS, observability, incident management, and AI-assisted operations.

We will work on building "SRE Copilot — AI Assisted Incident Management Platform" today. 

You must NOT jump directly to code.
You must always:
Plan
Ask for approval
Execute the plan step-by-step
Update progress


Throughout our session I'll ask you to plan your work ahead and create an md file for the plan. You may work only after I approve said plan. These plans will always be stored in aidlc-docs/plans folder. You will create many types of documents in the md format. Requirement, features changes documents will reside in aidlc-docs/requirements folder. User stories must be stored in the
aidlc-docs/story-artifacts folder. Architecture and Design documents must be stored in the aidlc-docs/design-artifacts folder. All prompts in order must be stored in the aidlc-docs/prompts.md file. Confirm your understanding of this prompt. Create the necessary folders and files for storage

Project Goal:
Build a system that:
Detects incidents in Kubernetes automatically
Sends alerts to Microsoft Teams
Collects diagnostics automatically
Performs AI-based root cause analysis
Suggests or executes runbooks
Generates incident timelines
Produces incident reports

System Architecture:
EKS Cluster
↓
kube-prometheus-stack (Prometheus + Alertmanager + Grafana)
↓
Alertmanager Webhook
↓
Incident Bot (Python FastAPI service)
↓
Microsoft Teams Alerts
↓
Automated Diagnostics
↓
AI Root Cause Analysis
↓
Runbook Suggestions / Automation
↓
Incident Timeline + Report

Repository Structure: 
sre-copilot/
aidlc-docs/
   plans/
   requirements/
   story-artifacts/
   design-artifacts/
   prompts.md
alerts/
bot/
   main.py
   alert_handler.py
   diagnostics.py
   teams_notifier.py
   ai_analysis.py
   runbook_executor.py
runbooks/
k8s/
docs/


Documentation Rules
All documents must be stored in Markdown (.md).
Document Type	Folder
Plans	aidlc-docs/plans
Requirements	aidlc-docs/requirements
User stories	aidlc-docs/story-artifacts
Architecture & design	aidlc-docs/design-artifacts
All prompts	aidlc-docs/prompts.md


We will work on building an application today.

For every frontend or backend component, create a project folder.

All documentation must be stored inside aidlc-docs.

Folder rules:

aidlc-docs/
   plans/
   requirements/
   story-artifacts/
   design-artifacts/

Rules:
Every major task must start with a plan document
Plans must contain checkbox steps
Plans must be approved before execution
After completing a step mark the checkbox as complete

You must also:
Store all prompts in order in aidlc-docs/prompts.md

Your first task:
Confirm understanding
Generate the folder structure


## Prompt 2: User Stories Generation Plan
yes this great
USER STORIES GENERATION
Your Role

You are an expert product manager.
You must convert the system requirements into clear user stories.
Before generating them:
Create a plan document
File:
aidlc-docs/plans/user_stories_plan.md
Plan requirements:
Include checkboxes
Each step must be clear
Ask for clarification where needed
Do not make major decisions without confirmation
After creating the plan:
Ask me to review and approve.
Only proceed after approval.

## Prompt 3: Execute Incident Bot Core Setup
yes i approved the user storys

(Implied: Proceed with executing the previously approved `02-incident-bot-core-plan.md` now that the user stories drafting is complete. Build out the FastAPI application, Pydantic data models for Prometheus Webhooks, basic logging, and the Dockerfile.)

## Prompt 4: Group User Stories into Design Units
After user stories are created:

Group them into independent development units.

Each unit should:

Be cohesive

Be buildable by a single team

Be loosely coupled

Example units:

1️⃣ Observability Integration
2️⃣ Incident Bot
3️⃣ Diagnostics Engine
4️⃣ AI Analysis Engine
5️⃣ Runbook Automation
6️⃣ Notification System
7️⃣ Incident Timeline System

Each unit must have its own file in:

aidlc-docs/design-artifacts/


## Prompt 5: Component Model Plan

You are an experienced software engineer.
Before designing components:
Create a plan:
aidlc-docs/plans/component_model_plan.md
Plan must include:
steps with checkboxes
clarification points
Ask for approval.

## Prompt 6: Execute Component Model Plan
yes approved now, 
Design the component model implementing all user stories.

Include:
components
attributes
behaviours
interactions
data flows
Example components:
Incident Bot
Alert Handler
Diagnostics Engine
Teams Notifier
AI Analyzer
Runbook Executor
Timeline Service
Store the component model:
aidlc-docs/design-artifacts/component_model.md

## Prompt 7: Verify Prompts File
check if all the prompts are present in promtmd file, if not add them make sure to add your title as AGENT1

# AGENT 2: Validation Prompts

## Prompt 1: Component Model Plan
You are an experienced software engineer.
Before designing components:
Create a plan:
aidlc-docs/plans/component_model_plan.md
Plan must include:
steps with checkboxes
clarification points
Ask for approval.

## Prompt 2: Execute Component Model Plan
Continue

## Prompt 3: Acknowledge execution
Continue

## Prompt 4: Verify Prompts File (AGENT2)
check if all the prompts are present in promtmd file, if not add them make sure to add your title as AGENT2

## Prompt 5: Fix Prompts File
check again and make sure to add the prompts in agent 2 section

## Prompt 6: Check for Missing Prompts
check for all the prompts i have given to you are there i can't see all of them

# AGENT3: Backend Implementation and Testing Prompts

## Prompt 1: Generate Backend Code
You are an experienced backend engineer.

Before generating code:
Create plan:
aidlc-docs/plans/code_generation_plan.md
Then implement the system.
Backend Stack
Python
FastAPI
Kubernetes
Required Modules
Generate full production-style code for:
bot/
main.py
alert_handler.py
diagnostics.py
teams_notifier.py
ai_analysis.py
runbook_executor.py
timeline.py
Features:
Alertmanager webhook receiver
Incident creation
Diagnostics collection
AI analysis
Runbook automation
Incident timeline

## Prompt 2: Local Kubernetes Deployment Testing
yes i want to have a Minikube or docker setup on my local system and run this project and test it 

## Prompt 3: AI Testing with API Key
i have update the openai key in deployment file update that and try test again 

## Prompt 4: Log LLM Response
what response i am getting for LLM where it is ? 

## Prompt 5: Generate Demo Script
now write a demo process that i can use to present the demos build a folder demo and create a md file in it which can driectly use for demo

## Prompt 6: Generate README
build a readme file for this project 

## Prompt 7: Explanation of Folders
we have two folders alerts and runbooks what are these for ?

## Prompt 8: Generate Presentation Prompt
now just write a prompt to make a PPT on this project which i can use to explain the project why this is import how can this project get mature what feature it has and what will be developed, and other points you can suugest this will be used to explain how AI can help in observibility

## Prompt 9: Update Prompts Documentation
check if all the prompts are present in promtmd file, if not add them make sure to add your title as AGENT3
