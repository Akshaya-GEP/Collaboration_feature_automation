# @llm_validation
# Feature: LLM Response Validation
# 
#   Background:
#     Given I have a valid QI Studio session (login and domain configured)
# 
#   @llm_validate_agent_creation @smoke
#   Scenario: Validate agent response for "agent creation"
#     When I navigate to Agentic Orchestrations
#     And I click to Create a new agent workflow
#     And I wait for the properties panel to load
#     When I set the agent name to "agent creation"
#     And I set the agent description to "test validation"
#     And I close the properties panel
#     And I save the properties panel
#     Then the orchestration canvas should be visible
#     When I open the JSON editor
#     And I paste the agent JSON from "bdd/data/core/agent_creation_testcase1.json"
#     And I click Sync changes
#     And I close the JSON editor
#     And I save the agent workflow
#     And I run the agent workflow
#     Then the chat interface should be visible
#     When I type and send message "What is procurement?" in the chat
#     Then the agent should correctly answer the query "What is procurement?"
# 
#   @multi_turn_validation @regression
#   Scenario: Multi-turn conversation validation with custom selectors
#     When I navigate to Agentic Orchestrations
#     And I click to Create a new agent workflow
#     And I wait for the properties panel to load
#     When I set the agent name to "multi-turn agent"
#     And I set the agent description to "test multi-turn"
#     And I close the properties panel
#     And I save the properties panel
#     Then the orchestration canvas should be visible
#     When I open the JSON editor
#     And I paste the agent JSON from "bdd/data/core/agent_creation_testcase1.json"
#     And I click Sync changes
#     And I close the JSON editor
#     And I save the agent workflow
#     And I run the agent workflow
#     Then the chat interface should be visible
#     And I use chat user query selector "Type your message here... (press enter to send)" and agent response selector "p.mb-0"
#     Then the agent conversation over 2 turns should match:
#       | userMessage                | expectedResponse                    | matchType |
#       | hi                         | Hi! How can I help                 | contains  |
#       | who is president of india? | Droupadi Murmu                     | contains  |
# 
#   @loaded_turns_json @llm_node @regression
#   Scenario: Validate agent with conversation turns loaded from JSON (llm-node)
#     When I navigate to Agentic Orchestrations
#     And I click to Create a new agent workflow
#     And I wait for the properties panel to load
#     When I set the agent name to "LLM Node Loaded Turns"
#     And I set the agent description to "test loaded turns"
#     And I close the properties panel
#     And I save the properties panel
#     Then the orchestration canvas should be visible
#     When I open the JSON editor
#     And I paste the agent JSON from "bdd/data/nodes/llm-node/llm_testcase1.json"
#     And I click Sync changes
#     And I close the JSON editor
#     And I save the agent workflow
#     And I run the agent workflow
#     Then the chat interface should be visible
#     Given I load conversation turns from "bdd/data/validation/llm-node-turns.json"
#     Then the agent conversation should match the loaded turns
# 
#   @loaded_turns_min_score @llm_node @regression
#   Scenario: Validate agent with loaded turns and minimum score threshold
#     When I navigate to Agentic Orchestrations
#     And I click to Create a new agent workflow
#     And I wait for the properties panel to load
#     When I set the agent name to "LLM Node Score Check"
#     And I set the agent description to "test score"
#     And I close the properties panel
#     And I save the properties panel
#     Then the orchestration canvas should be visible
#     When I open the JSON editor
#     And I paste the agent JSON from "bdd/data/nodes/llm-node/llm_testcase1.json"
#     And I click Sync changes
#     And I close the JSON editor
#     And I save the agent workflow
#     And I run the agent workflow
#     Then the chat interface should be visible
#     Given I load conversation turns from "bdd/data/validation/llm-node-turns.json"
#     Then the agent conversation should match the loaded turns and meet minimum score 0
# 
#   @loaded_turns_semantic @llm_validation @regression
#   Scenario: Validate agent with N turns from JSON (only user queries; intent by LLM; rules from validation config)
#     When I navigate to Agentic Orchestrations
#     And I click to Create a new agent workflow
#     And I wait for the properties panel to load
#     When I set the agent name to "Semantic Agent"
#     And I set the agent description to "test semantic"
#     And I close the properties panel
#     And I save the properties panel
#     Then the orchestration canvas should be visible
#     When I open the JSON editor
#     And I paste the agent JSON from "bdd/data/nodes/llm-node/llm_testcase1.json"
#     And I click Sync changes
#     And I close the JSON editor
#     And I save the agent workflow
#     And I run the agent workflow
#     Then the chat interface should be visible
#     Given I load conversation turns from "bdd/data/validation/semantic-turns.json"
#     Then the agent conversation should match the loaded turns
# 
#   @llm_generated_turns @regression
#   Scenario: Validate agent with LLM-generated conversation turns
#     When I navigate to Agentic Orchestrations
#     And I click to Create a new agent workflow
#     And I wait for the properties panel to load
#     When I set the agent name to "LLM Node Generated"
#     And I set the agent description to "test generated turns"
#     And I close the properties panel
#     And I save the properties panel
#     Then the orchestration canvas should be visible
#     When I open the JSON editor
#     And I paste the agent JSON from "bdd/data/nodes/llm-node/llm_testcase1.json"
#     And I click Sync changes
#     And I close the JSON editor
#     And I save the agent workflow
#     And I run the agent workflow
#     Then the chat interface should be visible
#     Given I generate 2 conversation turns using the LLM for scenario "general greeting and a short factual question"
#     Then the agent conversation should match the loaded turns and meet minimum score 0
