import { pool } from "../config/database";

interface CreateQuestionInput {
  questionText: string;
  timeLimit: number;
  points: number;
  options: {
    optionKey: string;
    optionText: string;
    isCorrect: boolean;
  }[];
}

export async function createQuestion(
  setId: string,
  userId: string,
  data: CreateQuestionInput,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Check Question Set ownership
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

    // 2. Insert Question
    const questionResult = await client.query(
      `INSERT INTO questions (
        set_id,
        question_text,
        time_limit,
        points
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        question_id,
        set_id,
        question_text,
        time_limit,
        points,
        created_at`,
      [setId, data.questionText, data.timeLimit, data.points],
    );

    const question = questionResult.rows[0];

    // 3. Insert Question Options
    const options = [];

    for (const option of data.options) {
      const optionResult = await client.query(
        `INSERT INTO question_options (
          question_id,
          option_key,
          option_text,
          is_correct
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
          option_id,
          option_key,
          option_text,
          is_correct`,
        [
          question.question_id,
          option.optionKey,
          option.optionText,
          option.isCorrect,
        ],
      );

      options.push(optionResult.rows[0]);
    }

    // 4. Commit Transaction
    await client.query("COMMIT");

    return {
      status: "CREATED",
      question: {
        ...question,
        options,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getAllQuestions(setId: string, userId: string) {
  const questionSet = await pool.query(
    `SELECT set_id
     FROM question_sets
     WHERE set_id = $1
     AND (user_id = $2 OR is_public = TRUE)`,
    [setId, userId],
  );

  if (questionSet.rows.length === 0) {
    return null;
  }

  const result = await pool.query(
    `SELECT
        q.question_id,
        q.set_id,
        q.question_text,
        q.time_limit,
        q.points,
        q.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'option_id', qo.option_id,
              'option_key', qo.option_key,
              'option_text', qo.option_text,
              'is_correct', qo.is_correct
            )
            ORDER BY qo.option_key
          ) FILTER (WHERE qo.option_id IS NOT NULL),
          '[]'
        ) AS options
     FROM questions q
     LEFT JOIN question_options qo
       ON q.question_id = qo.question_id
     WHERE q.set_id = $1
     GROUP BY q.question_id
     ORDER BY q.question_id`,
    [setId],
  );

  return result.rows;
}

export async function getQuestionById(
  setId: string,
  questionId: string,
  userId: string,
) {
  // ตรวจสอบสิทธิ์เข้าถึง Question Set
  const questionSet = await pool.query(
    `SELECT set_id
     FROM question_sets
     WHERE set_id = $1
     AND (user_id = $2 OR is_public = TRUE)`,
    [setId, userId],
  );

  if (questionSet.rows.length === 0) {
    return { status: "SET_NOT_FOUND" };
  }

  // ดึงข้อมูล Question และ Options
  const result = await pool.query(
    `SELECT
        q.question_id,
        q.set_id,
        q.question_text,
        q.time_limit,
        q.points,
        q.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'option_id', qo.option_id,
              'option_key', qo.option_key,
              'option_text', qo.option_text,
              'is_correct', qo.is_correct
            )
            ORDER BY qo.option_key
          ) FILTER (WHERE qo.option_id IS NOT NULL),
          '[]'
        ) AS options
     FROM questions q
     LEFT JOIN question_options qo
       ON q.question_id = qo.question_id
     WHERE q.set_id = $1
       AND q.question_id = $2
     GROUP BY q.question_id`,
    [setId, questionId],
  );

  if (result.rows.length === 0) {
    return { status: "QUESTION_NOT_FOUND" };
  }

  return {
    status: "SUCCESS",
    question: result.rows[0],
  };
}

export interface UpdateQuestionInput {
  questionText: string;
  timeLimit: number;
  points: number;
  options: {
    optionKey: "A" | "B" | "C" | "D";
    optionText: string;
    isCorrect: boolean;
  }[];
}

export async function updateQuestion(
  setId: string,
  questionId: string,
  userId: string,
  data: UpdateQuestionInput,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. ตรวจสอบว่าเป็นเจ้าของ Question Set หรือไม่
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
      return { status: "SET_NOT_FOUND" };
    }

    // 2. ตรวจสอบว่า Question อยู่ใน Question Set นี้จริงหรือไม่
    const question = await client.query(
      `SELECT question_id
       FROM questions
       WHERE question_id = $1
       AND set_id = $2
       FOR UPDATE`,
      [questionId, setId],
    );

    if (question.rows.length === 0) {
      await client.query("ROLLBACK");
      return { status: "QUESTION_NOT_FOUND" };
    }

    // 3. Update ข้อมูล Question
    await client.query(
      `UPDATE questions
       SET question_text = $1,
           time_limit = $2,
           points = $3
       WHERE question_id = $4
       AND set_id = $5`,
      [data.questionText, data.timeLimit, data.points, questionId, setId],
    );

    // 4. ลบ Options เดิม
    await client.query(
      `DELETE FROM question_options
       WHERE question_id = $1`,
      [questionId],
    );

    // 5. เพิ่ม Options ชุดใหม่
    for (const option of data.options) {
      await client.query(
        `INSERT INTO question_options (
          question_id,
          option_key,
          option_text,
          is_correct
        )
        VALUES ($1, $2, $3, $4)`,
        [questionId, option.optionKey, option.optionText, option.isCorrect],
      );
    }

    // 6. ดึงข้อมูลที่ Update แล้วกลับมา
    const result = await client.query(
      `SELECT
          q.question_id,
          q.set_id,
          q.question_text,
          q.time_limit,
          q.points,
          q.created_at,
          COALESCE(
            json_agg(
              json_build_object(
                'option_id', qo.option_id,
                'option_key', qo.option_key,
                'option_text', qo.option_text,
                'is_correct', qo.is_correct
              )
              ORDER BY qo.option_key
            ) FILTER (WHERE qo.option_id IS NOT NULL),
            '[]'
          ) AS options
       FROM questions q
       LEFT JOIN question_options qo
         ON q.question_id = qo.question_id
       WHERE q.question_id = $1
       GROUP BY q.question_id`,
      [questionId],
    );

    await client.query("COMMIT");

    return {
      status: "SUCCESS",
      question: result.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteQuestion(
  setId: string,
  questionId: string,
  userId: string,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. ตรวจสอบเจ้าของ Question Set
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
      return { status: "SET_NOT_FOUND" };
    }

    // 2. ตรวจสอบ Question
    const question = await client.query(
      `SELECT question_id
       FROM questions
       WHERE question_id = $1
       AND set_id = $2
       FOR UPDATE`,
      [questionId, setId],
    );

    if (question.rows.length === 0) {
      await client.query("ROLLBACK");
      return { status: "QUESTION_NOT_FOUND" };
    }

    // 3. ลบ Options ก่อน
    await client.query(
      `DELETE FROM question_options
       WHERE question_id = $1`,
      [questionId],
    );

    // 4. ลบ Question
    await client.query(
      `DELETE FROM questions
       WHERE question_id = $1
       AND set_id = $2`,
      [questionId, setId],
    );

    await client.query("COMMIT");

    return { status: "SUCCESS" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
