# @nodes @suite
# Feature: Node-Level Validation Suite
#   
#   # This feature validates all major node types using a SINGLE agent workflow.
#   # Strategy: One-shot creation, followed by multiple targeted queries.
# 
#   Background:
#     Given I have a valid QI Studio session (login and domain configured)
# 
#   @node_suite_run @smoke
#   Scenario: Validate all Node Types in a Single Workflow
#     # STEP 1: Create the Master Agent once
#     When I navigate to Agentic Orchestrations
#     And I click to Create a new agent workflow
#     And I wait for the properties panel to load
#     When I set the agent name to "Consolidated Node Suite"
#     And I set the agent description to "comprehensive test of all node types"
#     And I close the properties panel
#     And I save the properties panel
#     Then the orchestration canvas should be visible
#     When I open the JSON editor
#     And I paste the agent JSON from "bdd/data/nodes/suite_testcase1.json"
#     And I click Sync changes
#     And I close the JSON editor
#     And I save the agent workflow
#     And I run the agent workflow
#     Then the chat interface should be visible
#     
#     # Run Validation (Heartbeat)
#     When I start intercepting the chat API response
#     And I send and track message "Hi" in the chat
#     Then the chat API response status should be 200
#     
#     # STEP 2: Verify LLM Node
#     Then the agent should correctly answer the query "Test LLM Node"
# 
#     # STEP 3: Verify Rule Node
#     Then the agent should correctly answer the query "Trigger Rule Branch"
# 
#     # STEP 4: Verify System Tools
#     Then the agent should correctly answer the query "Invoke System Tool"
# 
#     # STEP 5: Verify Shared Tools
#     Then the agent should correctly answer the query "Use Shared Tool"
# 
#     # STEP 6: Verify MCP Tools
#     Then the agent should correctly answer the query "Call MCP Tool"
