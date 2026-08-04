import "dotenv/config";
import { encryptPasswordSync } from "@utils/helpers/crypto";
import process from "process";
import { RoleName } from "@prisma/client";
import { UserCreateDTO } from "@DTOs/user/UserCreateDTO";

export const seed_users: { id: number, isToBeSeeded: boolean, dto: UserCreateDTO }[] = [
  {
    id: 1,
    isToBeSeeded: true,

    dto: {
      username: process.env.GOD_USERNAME!,
      password: encryptPasswordSync(process.env.GOD_PASSWORD!),
      avatarUrl: `https://ui-avatars.com/api/?name=${ process.env.GOD_USERNAME! }`,
      roles: [
        {
          roleName: RoleName.GOD,
          isActive: true
        },
        {
          roleName: RoleName.ADMIN,
          isActive: true
        },
        {
          roleName: RoleName.DANCER,
          isActive: true
        },
      ],
      person: {
        name: "god",
        surname: "god",
        personType: "USER"
      },
      contact: {
        email: "god@overzoom.it",
      },
    },
  },
  {
    isToBeSeeded: process.env.NODE_ENV === 'development',
    id: 2,
    dto: {
      username: "admin",
      password: encryptPasswordSync("admin"),
      avatarUrl: `https://ui-avatars.com/api/?name=admin`,
      roles: [ { roleName: RoleName.ADMIN, isActive: true } ],
      person: {
        name: "admin",
        surname: "admin",
        personType: "USER"
      },
      contact: {
        email: "admin@overzoom.it",
      },
    }
  },
  {
    isToBeSeeded: process.env.NODE_ENV === 'development',
    id: 3,
    dto: {
      username: "user",
      password: encryptPasswordSync("user"),
      avatarUrl: `https://ui-avatars.com/api/?name=user`,
      roles: [ { roleName: RoleName.DANCER, isActive: true } ],
      person: {
        name: "user",
        surname: "user",
        personType: "USER"
      },
      contact: {
        email: "user@overzoom.it",
      },
    }

  },
]
