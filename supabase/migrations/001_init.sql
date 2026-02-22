-- タスク管理システム初期スキーマ

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  name TEXT NOT NULL DEFAULT '',
  due_type TEXT NOT NULL DEFAULT 'none' CHECK (due_type IN (
    'specific_date', 'none', 'today', 'this_week', 'this_month',
    'this_year', 'next_year_plus',
    'repeat_daily', 'repeat_weekly', 'repeat_monthly', 'repeat_yearly'
  )),
  due_date DATE,
  estimated_time_value DECIMAL,
  estimated_time_unit TEXT CHECK (estimated_time_unit IN ('mo', 'day', 'h', 'min')),
  actual_time_value DECIMAL,
  actual_time_unit TEXT CHECK (actual_time_unit IN ('mo', 'day', 'h', 'min')),
  notes TEXT NOT NULL DEFAULT '',
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  position FLOAT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own tasks"
  ON tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- インデックス
CREATE INDEX tasks_user_id_idx ON tasks(user_id);
CREATE INDEX tasks_parent_id_idx ON tasks(parent_id);
CREATE INDEX tasks_user_position_idx ON tasks(user_id, position);
CREATE INDEX tasks_archived_idx ON tasks(user_id, archived) WHERE archived = FALSE;

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
