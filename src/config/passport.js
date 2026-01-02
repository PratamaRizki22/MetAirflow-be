const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const _jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const { prisma } = require('./database');

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BASE_URL}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0]?.value;
        const name = profile.displayName;
        const googleId = profile.id;
        const profilePicture = profile.photos[0]?.value || null;

        if (!email) {
          return done(new Error('No email found from Google profile'), null);
        }

        // Check if user already exists
        let user = await prisma.user.findUnique({
          where: { email },
        });

        if (user) {
          // User exists, update Google ID and profile picture if not set
          const updateData = {};
          if (!user.googleId) {
            updateData.googleId = googleId;
          }
          if (!user.profilePicture && profilePicture) {
            updateData.profilePicture = profilePicture;
          }

          if (Object.keys(updateData).length > 0) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: updateData,
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                name: true,
                phone: true,
                profilePicture: true,
                role: true,
                isActive: true,
                createdAt: true,
              },
            });
          } else {
            // Just return user with updated select fields for consistency
            user = await prisma.user.findUnique({
              where: { id: user.id },
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                name: true,
                phone: true,
                profilePicture: true,
                role: true,
                isActive: true,
                createdAt: true,
              },
            });
          }
        } else {
          // Create new user
          const randomPassword = await bcrypt.hash(
            Math.random().toString(36).substring(2, 15),
            12
          );

          // Split name into firstName and lastName
          const nameParts = name.split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';

          user = await prisma.user.create({
            data: {
              email,
              firstName,
              lastName,
              name,
              password: randomPassword,
              googleId,
              profilePicture,
              role: 'USER',
              isActive: true,
              verifiedAt: new Date(),
            },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              name: true,
              phone: true,
              profilePicture: true,
              role: true,
              isActive: true,
              createdAt: true,
            },
          });
        }

        return done(null, user);
      } catch (error) {
        console.error('Google OAuth error:', error);
        return done(error, null);
      }
    }
  )
);

module.exports = {
  passport,
};
