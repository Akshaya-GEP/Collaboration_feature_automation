# @nodes @invoke_orchestration_node
# Feature: Invoke Orchestration Node
# 
#   Background:
#     Given I have a valid QI Studio session (login and domain configured)
# 
#   @smoke @regression
#   Scenario: Invoke Orchestration Node - Run and LLM Validation
#     When I navigate to Agentic Orchestrations
#     And I click to Create a new agent workflow
#     And I wait for the properties panel to load
#     When I set the agent name to "Invoke Orchestration Node"
#     And I set the agent description to "invoke orchestration node test"
#     # And I close the properties panel
#     # And I save the properties panel
#     Then the orchestration canvas should be visible
#     When I open the JSON editor
#     And I paste the agent JSON from "bdd/data/nodes/invoke-orchestration-node/invoke_orchestration_testcase1.json"
#     And I click Sync changes
#     And I close the JSON editor
#     And I save the agent workflow
#     And I run the agent workflow
#     Then the chat interface should be visible
#     # Run Validation
#     When I start intercepting the chat API response
#     And I send and track message "Hi" in the chat
#     Then the chat API response status should be 200
#     # LLM Validation
#     And I capture the agent response text
#     And the LLM response should be validated by LLM judge for intent "Greeting"
