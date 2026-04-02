// src/controllers/frontend.controller.js
import { supabase } from '../config/supabase.js';

export const signUp = async (req, res) => {
  const { email, password, full_name, phone_number } = req.body;
  
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: "이메일, 비밀번호, 이름은 필수입니다." });
  }

  console.log("들어온 데이터:", { email, full_name, phone_number });
  
  const { data : authData, error : authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: full_name,
        phone_number: phone_number//profiles 테이블로 들어감, 선택 사항
      }
    }
  });

  if (authError) return res.status(400).json({ error: authError.message });
  // 2. 가입된 유저의 ID를 가져와서 profiles 테이블에 추가 저장
  if (authData.user) {
    const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      { 
        id: authData.user.id, 
        full_name: full_name, 
        phone_number: phone_number || "",
        email: email 
      }, 
      { onConflict: 'id' } // 두 번째 인자로 옵션 객체 전달
    );

    if (profileError) {
      console.error("프로필 저장 실패:", profileError);
      // 유저는 생성됐지만 프로필 저장이 실패한 경우에 대한 처리가 필요할 수 있습니다.
    }
  }

  return res.status(200).json({ message: "회원가입 및 프로필 저장 완료", user: authData.user });
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

// src/controllers/frontend.controller.js

export const deleteUser = async (req, res) => {
  // 1. 인증 토큰 확인
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 토큰이 필요합니다." });

  const token = authHeader.split(' ')[1];
  
  // 2. 토큰으로 현재 로그인한 유저 정보 가져오기
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "유효하지 않은 사용자입니다." });

  try {
    // 3. profiles 테이블에서 데이터 삭제 (필요 시)
    // DB 설정에서 ON DELETE CASCADE를 걸어두었다면 이 과정은 생략 가능합니다.
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);

    if (profileError) throw profileError;

    /**
     * 4. Auth 계정 삭제
     * 주의: supabase.auth.admin.deleteUser()를 쓰려면 
     * supabase 설정 시 service_role 키를 사용해야 합니다.
     * 일반 anon 키로는 본인 삭제가 제한될 수 있습니다.
     */
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    
    if (deleteError) return res.status(500).json({ error: "계정 삭제 중 오류 발생", details: deleteError.message });

    return res.status(200).json({ message: "성공적으로 탈퇴되었습니다." });
    
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// src/controllers/frontend.controller.js

export const updatePassword = async (req, res) => {
  const { new_password } = req.body;

  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: "새 비밀번호는 최소 6자 이상이어야 합니다." });
  }

  // 1. 요청 헤더에서 토큰 추출
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 토큰이 필요합니다." });

  const token = authHeader.split(' ')[1];

  // 2. 해당 토큰을 가진 유저의 비밀번호 업데이트
  // updatePassword 대신 updateUser를 사용하며, 내부 인자로 password를 전달합니다.
  const { data, error } = await supabase.auth.updateUser({
    password: new_password
  }, {
    // 옵션: 관리자 키를 사용 중이더라도 현재 토큰의 주인을 수정하도록 명시
    accessToken: token 
  });

  if (error) {
    return res.status(400).json({ error: "비밀번호 수정 실패", details: error.message });
  }

  return res.status(200).json({ 
    message: "비밀번호가 성공적으로 변경되었습니다.",
    user: data.user 
  });
};