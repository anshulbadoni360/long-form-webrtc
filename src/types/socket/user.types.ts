export interface CreateUserPayload {
  user: {
    ID?: string;
    uuid?: string;
    email?: string;
    roomid: string;
    name: string;
    proctor?: string;
  };
}

export interface PrivateMessagePayload {
  uuid: string;
  msg: string;
}
