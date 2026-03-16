@agent_creation
Feature: Agent Creation Flow

  Background:
    Given I have a valid QI Studio session (login and domain configured)

  @agent_creation @smoke
  Scenario: Create a Basic Agent
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow
    And I wait for the properties panel to load
    When I set the agent name to "Basic Agent"
    And I set the agent description to "Created via JSON paste"
    And I close the properties panel
    And I save the properties panel
    Then the orchestration canvas should be visible
    When I open the JSON editor
    And I paste the agent JSON from "bdd/data/core/agent_creation_testcase1.json"
    And I click Sync changes
    And I close the JSON editor
    And I save the agent workflow
    And I run the agent workflow
    Then the chat interface should be visible
