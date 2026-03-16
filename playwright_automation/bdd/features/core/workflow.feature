@workflow
Feature: Workflow Management

  Background:
    Given I have a valid QI Studio session (login and domain configured)

  @workflow @smoke
  Scenario: Create and Run a Workflow
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow
    And I wait for the properties panel to load
    When I set the agent name to "Workflow Test"
    And I set the agent description to "test workflow run"
    And I close the properties panel
    And I save the properties panel
    Then the orchestration canvas should be visible
    When I open the JSON editor
    And I paste the agent JSON from "bdd/data/core/agent_testcase1.json"
    And I click Sync changes
    And I close the JSON editor
    And I save the agent workflow
    And I run the agent workflow
    Then the chat interface should be visible
