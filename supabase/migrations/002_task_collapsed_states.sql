-- タスク折りたたみ状態（ユーザーごと）
CREATE TABLE IF NOT EXISTS task_collapsed_states (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, task_id)
);

ALTER TABLE task_collapsed_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own collapsed states"
  ON task_collapsed_states FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX task_collapsed_states_user_id_idx ON task_collapsed_states(user_id);
