const { prisma } = require('../../src/config/database');

async function seedRatings() {
  console.log('  📝 Creating property ratings...');

  try {
    // Get all properties
    const properties = await prisma.property.findMany({
      select: { id: true },
    });

    // Get all users (tenants)
    const users = await prisma.user.findMany({
      where: { role: 'USER' },
      select: { id: true },
    });

    if (properties.length === 0 || users.length === 0) {
      console.log('  ⚠️  No properties or users found. Skipping ratings.');
      return { created: 0 };
    }

    const ratingsData = [];

    // Add 3-5 ratings per property
    for (const property of properties) {
      const numRatings = Math.floor(Math.random() * 3) + 3; // 3-5 ratings
      const usedUserIds = new Set();

      for (let i = 0; i < numRatings && usedUserIds.size < users.length; i++) {
        // Pick a random user that hasn't rated this property yet
        let randomUser;
        do {
          randomUser = users[Math.floor(Math.random() * users.length)];
        } while (usedUserIds.has(randomUser.id));

        usedUserIds.add(randomUser.id);

        // Generate rating (weighted towards higher ratings)
        const rand = Math.random();
        let rating;
        if (rand < 0.5) rating = 5;
        else if (rand < 0.75) rating = 4;
        else if (rand < 0.9) rating = 3;
        else if (rand < 0.97) rating = 2;
        else rating = 1;

        const reviews = {
          5: [
            'Amazing property! Highly recommended.',
            'Perfect location and great amenities.',
            'Excellent experience, will definitely come back!',
            'The host was very helpful and the place was spotless.',
            "Best rental experience I've had!",
          ],
          4: [
            'Great place, just minor issues with parking.',
            'Very good overall, would recommend.',
            'Nice property, good value for money.',
            'Comfortable stay, everything as described.',
          ],
          3: [
            'Decent place, but could use some improvements.',
            'Average experience, nothing special.',
            'It was okay, met basic expectations.',
          ],
          2: [
            'Not as described, several issues.',
            'Below expectations, needs maintenance.',
          ],
          1: ['Very disappointing, would not recommend.'],
        };

        const reviewOptions = reviews[rating];
        const comment =
          reviewOptions[Math.floor(Math.random() * reviewOptions.length)];

        ratingsData.push({
          propertyId: property.id,
          userId: randomUser.id,
          rating,
          comment,
          ratedAt: new Date(
            Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
          ), // Random date within last 30 days
        });
      }
    }

    // Create all ratings
    const created = await prisma.propertyRating.createMany({
      data: ratingsData,
      skipDuplicates: true,
    });

    console.log(`  ✅ Created ${created.count} property ratings`);
    return { created: created.count };
  } catch (error) {
    console.error('  ❌ Error seeding ratings:', error.message);
    throw error;
  }
}

module.exports = { seedRatings };
