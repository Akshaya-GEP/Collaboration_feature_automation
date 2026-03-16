# @unified_template
# Feature: Master Unified Template
# 
#   Background:
#     Given I have a valid QI Studio session (login and domain configured)
# 
#   @template_demo @smoke
#   Scenario: Create and Validate a Generic Agent
#     # STEP 1: Unified Agent Creation (using a JSON blueprint)
#     When I navigate to Agentic Orchestrations
#     And I click to Create a new agent workflow
#     And I wait for the properties panel to load
#     When I set the agent name to "Unified Demo Agent"
#     And I set the agent description to "Production template test"
#     And I close the properties panel
#     And I save the properties panel
#     Then the orchestration canvas should be visible
#     When I open the JSON editor
#     And I paste the agent JSON from "bdd/data/core/agent_creation_testcase1.json"
#     And I click Sync changes
#     And I close the JSON editor
#     And I save the agent workflow
#     And I run the agent workflow
#     
#     # STEP 2: Validation (rules from validationConfig; expectedIntent from LLM)
#     Then the agent should correctly answer the query "What can you do?"
