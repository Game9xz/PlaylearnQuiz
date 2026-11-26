import { pool } from "../config/database";

interface CreateQuestionSetInput {
  userId: string;
  title: string;
  description?: string;
  isPublic?: boolean;
}

export async function createQuestionSet(data: CreateQuestionSetInput) {
  const result = await pool.query(
    `INSERT INTO question_sets (
            user_id,
            title,
            description,
            is_public
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
            set_id,
            user_id,
            title,
            description,
            is_public,
            created_at,
            updated_at`,
    [data.userId, data.title, data.description ?? null, data.isPublic ?? false],
  );

  return result.rows[0];
}

export async function getAllQuestionSets(userId: string) {
  const result = await pool.query(
    `SELECT
            set_id,
            user_id,
            title,
            description,
            created_at,
            updated_at
         FROM question_sets
         WHERE user_id = $1
         ORDER BY created_at DESC`,
    [userId],
  );

  return result.rows;
}

export async function getQuestionSetById(setId: string, userId: string) {
  const result = await pool.query(
    `SELECT
            set_id,
            user_id,
            title,
            description,
            is_public,
            created_at,
            updated_at
         FROM question_sets
         WHERE set_id = $1
         AND (user_id = $2 OR is_public = TRUE)`,
    [setId, userId],
  );

  return result.rows[0] || null;
}

export async function updateQuestionSet(
  setId: string,
  userId: string,
  title: string,
  description: string,
  isPublic: boolean,
) {
  const result = await pool.query(
    `UPDATE question_sets
         SET
            title = $1,
            description = $2,
            is_public = $3,
            updated_at = NOW()
         WHERE set_id = $4
         AND user_id = $5
         RETURNING
            set_id,
            user_id,
            title,
            description,
            is_public,
            created_at,
            updated_at`,
    [title, description, isPublic, setId, userId],
  );

  return result.rows[0] || null;
}

export async function deleteQuestionSet(setId: string, userId: string) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Check ownership and lock the question set
    const questionSet = await client.query(
      `SELECT set_id
             FROM question_sets
             WHERE set_id = $1
             AND user_id = $2
             FOR UPDATE`,
      [setId, userId],
    );

    if (questionSet.rows.length === 0) {
      await client.query("ROLLBACK");
      return { status: "NOT_FOUND" };
    }

    // 2. Check whether this question set is used by rooms
    const rooms = await client.query(
      `SELECT room_id
             FROM rooms
             WHERE set_id = $1
             LIMIT 1`,
      [setId],
    );

    if (rooms.rows.length > 0) {
      await client.query("ROLLBACK");
      return { status: "IN_USE" };
    }

    // 3. Delete question options
    await client.query(
      `DELETE FROM question_options
             WHERE question_id IN (
                SELECT question_id
                FROM questions
                WHERE set_id = $1
             )`,
      [setId],
    );

    // 4. Delete questions
    await client.query(
      `DELETE FROM questions
             WHERE set_id = $1`,
      [setId],
    );

    // 5. Delete question set
    await client.query(
      `DELETE FROM question_sets
             WHERE set_id = $1
             AND user_id = $2`,
      [setId, userId],
    );

    await client.query("COMMIT");

    return { status: "DELETED" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
