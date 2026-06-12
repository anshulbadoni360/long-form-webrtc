import { User, buildUserLookup } from "../../models/users.model";
import { Room } from "../../models/rooms.model";
import log from "../logger/log";

export class UserService {
  /**
   * Finds a user by their email/ID/uuid.
   */
  public async findUserByEmail(email: string) {
    if (!email) return null;
    try {
      return await User.findOne(buildUserLookup(email));
    } catch (error: any) {
      log.error(
        `[UserService] Failed to find user by email/ID ${email}:`,
        error.message || error,
      );
      return null;
    }
  }

  /**
   * Gets the role of a user in a specific room.
   */
    public async getUserRole(userId: string, roomid?: string): Promise<string> {
      // Check room-level roles first (observer / cohost)
      if (roomid) {
        try {
          const room = await Room.findOne({ roomid });
          if (room) {
            const user = await this.findUserByEmail(userId);
            const email = user?.email || userId;
  
            // Co-host check (email match against cohosts array)
            if (room.cohosts && room.cohosts.includes(email)) {
              log.info(
                `[UserService] Resolved room-level role: cohost for ${email} in room ${roomid}`,
              );
              return "cohost";
            }
  
            // Observer check (single email, multi-email array, and observers array)
            const isObserver =
              room.observerEmail === email ||
              (room.multiObserversEmail &&
                room.multiObserversEmail.includes(email)) ||
              (room.observers && room.observers.includes(email));
  
            if (isObserver) {
              log.info(
                `[UserService] Resolved room-level role: observer for ${email} in room ${roomid}`,
              );
              return "observer";
            }
          }
          return "student";
        } catch (error: any) {
          log.warn(
            `[UserService] Could not resolve room-level role for ${userId} in room ${roomid}: ${error.message}`,
          );
        }
      }
  
      // Fall back to the user's account-level role (teacher / student)
      const user = await this.findUserByEmail(userId);
      return user && user.userType ? String(user.userType) : "student";
    }

  /**
   * Updates a user's active socket status and room mapping.
   */
  public async updateUserSocketConnection(
    email: string,
    socketId: string,
    roomid: string,
    role: string,
  ): Promise<boolean> {
    try {
      const user = await User.findOne(buildUserLookup(email));

      if (user) {
        user.active = true;
        user.sid = socketId;
        user.roomid = roomid;
        user.userType = role as any;
        await user.save();
      } else {
        const isEmail = email.includes("@");
        await User.create({
          ID: email,
          uuid: isEmail ? undefined : email,
          email: isEmail ? email : undefined,
          name: "User-" + email.substring(0, 5),
          active: true,
          sid: socketId,
          roomid: roomid,
          userType: role as any,
        });
      }
      return true;
    } catch (error: any) {
      log.error(
        `[UserService] Failed to update user connection for ${email}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Sets a user's connection status to offline.
   */
  public async setUserOffline(email: string): Promise<boolean> {
    try {
      await User.findOneAndUpdate(buildUserLookup(email), {
        active: false,
        sid: "",
      });
      return true;
    } catch (error: any) {
      log.error(
        `[UserService] Failed to set user ${email} offline:`,
        error.message || error,
      );
      return false;
    }
  }
}

export const userService = new UserService();
export default userService;
