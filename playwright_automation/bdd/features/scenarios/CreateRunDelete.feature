# @create_run_delete
# Feature: Full Lifecycle - Create, Run, and Delete
# 
#   Background:
#     Given I have a valid QI Studio session (login and domain configured)
# 
#   @lifecycle @smoke
#   Scenario: End-to-End Lifecycle of an Agent
#     # 1. Create
#     When I navigate to Agentic Orchestrations
#     And I click to Create a new agent workflow
#     And I wait for the properties panel to load
#     When I set the agent name to "Restored Lifecycle Agent"
#     And I set the agent description to "test lifecycle"
#     And I close the properties panel
#     And I save the properties panel
#     Then the orchestration canvas should be visible
#     When I open the JSON editor
#     And I paste the agent JSON from "bdd/data/core/agent_testcase1.json"
#     And I click Sync changes
#     And I close the JSON editor
#     And I save the agent workflow
# 
#     # 2. Run
#     And I run the agent workflow
#     Then the chat interface should be visible
#     And I type and send message "Hello" in the chat
#     And I receive a response in the chat
# 
#     # 3. Delete
#     Then I delete the agent workflow
#     And the agent should no longer exist in the list
