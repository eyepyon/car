pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

/**
 * ハッシュ値を生成するメソッド
 */
template PasswordCheck() {
  // 入力値を取得
  signal input password;      
  signal input hash;    

  component poseidon = Poseidon(1);
  poseidon.inputs[0] <== password;
  hash === poseidon.out;  // ハッシュ値の一致を検証(true or falseを返す)
}

// パブリック入力： パスワードのハッシュ値
// プライベート入力： パスワード
component main {public [hash]} = PasswordCheck();