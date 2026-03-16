@fail_test
Feature: Failure Report Verification

  Background:
    Given I have a valid QI Studio session (login and domain configured)

  @json_agent @fail
  Scenario: Verify JSON attachment on failure
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow
    And I wait for the properties panel to load
    When I set the agent name to "Failure Test"
    And I set the agent description to "Testing report attachments"
    And I close the properties panel
    And I save the properties panel
    Then the orchestration canvas should be visible
    When I open the JSON editor
    And I paste the agent JSON from "bdd/data/core/agent_testcase1.json"
    Then this step will fail intentionally
