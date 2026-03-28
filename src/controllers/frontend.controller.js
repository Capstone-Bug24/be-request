// src/controllers/frontend.controller.js
import { supabase } from '../config/supabase.js';

export const signUp = async (req, res) => {
  const { email, password, phone_number, full_name } = req.body;
  
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: "이메일, 비밀번호, 이름은 필수입니다." });
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: full_name,
        phone_number: phone_number || NULL //profiles 테이블로 들어감, 선택 사항
      }
    }
  });

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ message: "회원가입 성공! 이메일을 확인해주세요.", data });
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
  if (error) return res.status(401).json({ error: "이메일 또는 비밀번호가 틀렸습니다." });
  
  //pofiles 테이블에서 이름 가져오기
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', data.user.id)
    .single();
  
  res.json({ 
    message: "로그인 성공!",
    token: data.session.access_token,
    user: {
      ...data.user,
      full_name: profile?.full_name //프로필정보 합치기 
    }
  });
};

// src/controllers/frontend.controller.js

export const updateProfile = async (req, res) => {
  const { full_name, phone_number } = req.body;
  
  // 1. 요청 헤더에서 토큰을 추출하여 유저 정보 가져오기
  // 프론트엔드에서 'Authorization: Bearer <token>' 형태로 보내야 합니다.
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 토큰이 필요합니다." });

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) return res.status(401).json({ error: "유효하지 않은 토큰입니다." });

  // 2. profiles 테이블 업데이트
  const { data, error } = await supabase
    .from('profiles')
    .update({ 
      full_name, 
      phone_number,
      updated_at: new Date() 
    })
    .eq('id', user.id) // 본인 아이디인 경우만!
    .select();

  if (error) return res.status(500).json({ error: error.message });

  res.json({ 
    message: "프로필이 성공적으로 업데이트되었습니다.", 
    data: data[0] 
  });
};