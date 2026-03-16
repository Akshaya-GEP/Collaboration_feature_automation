# @auth @login
# Feature: QI Studio Authentication
# 
#   Background:
#     Given I open QI Studio workflow app
# 
#   @login @smoke
#   Scenario: Successful Login to QI Studio
#     When I log in to QI Studio using credentials from env
#     And I configure domain if domain configuration dialog appears
