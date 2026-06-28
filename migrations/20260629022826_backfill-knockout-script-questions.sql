UPDATE matches
SET knockout_script_question_key = (
  CASE match_number % 8
    WHEN 0 THEN 'reaches_extra_time'
    WHEN 1 THEN 'reaches_penalties'
    WHEN 2 THEN 'decided_in_90'
    WHEN 3 THEN 'winner_clean_sheet'
    WHEN 4 THEN 'both_teams_score_90'
    WHEN 5 THEN 'late_goal_after_75'
    WHEN 6 THEN 'red_card'
    ELSE 'penalty_goal'
  END
)::knockout_script_question_key
WHERE stage IN ('round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final')
  AND knockout_script_question_key IS NULL;
