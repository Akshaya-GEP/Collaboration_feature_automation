@nodes @rule_node
Feature: Rule Node Validation

  Background:
    Given I have a valid QI Studio session (login and domain configured)

  @smoke
  Scenario: Rule Node - Successful Branching
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow
    And I wait for the properties panel to load
    When I set the agent name to "Rule Node"
    And I set the agent description to "test rule branching"
    And I close the properties panel
    And I save the properties panel
    Then the orchestration canvas should be visible
    When I open the JSON editor
    And I paste the agent JSON from "bdd/data/nodes/rule-node/rule_node_testcase1.json"
    And I click Sync changes
    And I close the JSON editor
    And I save the agent workflow
    And I run the agent workflow
    Then the chat interface should be visible
    # Run Validation
    When I start intercepting the chat API response
    And I send and track message "Trigger rule" in the chat
    Then the chat API response status should be 200
    # LLM Validation
    And I capture the agent response text
    And the LLM response should be validated by LLM judge for intent "Successful rule branching"

  @multi_turn @llm_validator @regression
  Scenario: Rule Node - Multi-turn conversation (n=2) with LLM validator
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow
    And I wait for the properties panel to load
    When I set the agent name to "Rule Node Multi-turn"
    And I set the agent description to "test rule branching multi-turn"
    And I close the properties panel
    And I save the properties panel
    Then the orchestration canvas should be visible
    When I open the JSON editor
    And I paste the agent JSON from "bdd/data/nodes/rule-node/rule_node_testcase1.json"
    And I click Sync changes
    And I close the JSON editor
    And I save the agent workflow
    And I run the agent workflow
    Then the chat interface should be visible
    # Run Validation & LLM Validation (Multi-turn)
    Given I load conversation turns from "bdd/data/validation/rule-node-turns.json"
    Then the agent conversation should match the loaded turns
