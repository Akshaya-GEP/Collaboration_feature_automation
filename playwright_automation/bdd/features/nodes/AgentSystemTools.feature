@nodes @system_tools
Feature: Agent Node - System Tools

  Background:
    Given I have a valid QI Studio session (login and domain configured)

  @smoke
  Scenario: Agent System Tools - Successful Invocation
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow
    And I wait for the properties panel to load
    When I set the agent name to "Agent System Tools"
    And I set the agent description to "test system tool"
    And I close the properties panel
    And I save the properties panel
    Then the orchestration canvas should be visible
    When I open the JSON editor
    And I paste the agent JSON from "bdd/data/nodes/agent-system-tools/system_tools_testcase1.json"
    And I click Sync changes
    And I close the JSON editor
    And I save the agent workflow
    And I run the agent workflow
    Then the chat interface should be visible
    # Run Validation
    When I start intercepting the chat API response
    And I send and track message "Use system tool" in the chat
    Then the chat API response status should be 200
    # LLM Validation
    And I capture the agent response text
    And the LLM response should be validated by LLM judge for intent "Successful system tool usage"

