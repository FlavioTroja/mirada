import { encryptPasswordSync } from "@utils/helpers/crypto";
import { RoleName } from "@prisma/client";
import { UserCreateDTO } from "@DTOs/user/UserCreateDTO";

export const seed_users: { id: number, dto: UserCreateDTO }[] = [
  {
    id: 1,
    dto: {
      username: "god",
      password: encryptPasswordSync("god"),
      avatarUrl: `https://ui-avatars.com/api/?name=go`,
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
    },

  },
  {
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
          email: "user@overzoom.it"
      },
    }
  },
]
