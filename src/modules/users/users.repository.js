const { prisma } = require('../../config/database');

class UsersRepository {
  async findMany(options = {}) {
    const {
      where = {},
      skip = 0,
      take = 10,
      orderBy = { createdAt: 'desc' },
    } = options;

    return await prisma.user.findMany({
      where,
      skip,
      take,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        dateOfBirth: true,
        phone: true,
        profilePicture: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy,
    });
  }

  async count(where = {}) {
    return await prisma.user.count({ where });
  }

  async findById(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        dateOfBirth: true,
        phone: true,
        profilePicture: true,
        role: true,
        isHost: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        properties: {
          select: {
            id: true,
          },
          take: 1, // Only need to know if at least one exists
        },
      },
    });

    if (!user) return null;

    // Add computed isLandlord field (TRUE if manually set as host OR has properties)
    const { properties, ...userData } = user;
    return {
      ...userData,
      isLandlord: userData.isHost || properties.length > 0,
    };
  }

  async findByEmail(email) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        dateOfBirth: true,
        phone: true,
        profilePicture: true,
        role: true,
        isHost: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        password: true, // Needed for auth/login check
        properties: {
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

    if (!user) return null;

    // Add computed isLandlord field
    const { properties, ...userData } = user;
    return {
      ...userData,
      isLandlord: userData.isHost || properties.length > 0,
    };
  }

  async create(userData) {
    // Compute name from firstName and lastName
    const computedName =
      `${userData.firstName || ''} ${userData.lastName || ''}`.trim();

    const createdUser = await prisma.user.create({
      data: {
        ...userData,
        name: computedName,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        dateOfBirth: true,
        phone: true,
        profilePicture: true,
        role: true,
        isHost: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Return with isLandlord (default false for new user usually)
    return {
      ...createdUser,
      isLandlord: createdUser.isHost, // Should be false initially unless specified
    };
  }

  async update(id, updateData) {
    // Compute name from firstName and lastName if either is being updated
    const dataToUpdate = { ...updateData };
    if (
      updateData.firstName !== undefined ||
      updateData.lastName !== undefined
    ) {
      // Get current user data to have complete firstName and lastName
      const currentUser = await prisma.user.findUnique({
        where: { id },
        select: { firstName: true, lastName: true },
      });

      const firstName =
        updateData.firstName !== undefined
          ? updateData.firstName
          : currentUser?.firstName || '';
      const lastName =
        updateData.lastName !== undefined
          ? updateData.lastName
          : currentUser?.lastName || '';
      dataToUpdate.name = `${firstName} ${lastName}`.trim();
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        dateOfBirth: true,
        phone: true,
        profilePicture: true,
        role: true,
        isHost: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      ...updatedUser,
      isLandlord: updatedUser.isHost, // Note: we don't check properties here for simplicity, assuming update doesn't change property ownership directly
    };
  }

  async delete(id) {
    return await prisma.user.delete({
      where: { id },
    });
  }
}

module.exports = new UsersRepository();
