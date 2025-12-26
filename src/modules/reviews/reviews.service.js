const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class ReviewsService {
    /**
     * Create a new review
     */
    async createReview(data, userId) {
        const { leaseId, propertyId, rating, comment } = data;

        // Validation
        if (!rating || rating < 1 || rating > 5) {
            throw new Error('Rating must be between 1 and 5');
        }

        if (!comment || comment.trim().length < 10) {
            throw new Error('Comment must be at least 10 characters');
        }

        // Check if lease exists and belongs to user
        const lease = await prisma.lease.findUnique({
            where: { id: leaseId },
            include: { property: true },
        });

        if (!lease) {
            throw new Error('Booking not found');
        }

        if (lease.tenantId !== userId) {
            throw new Error('Not authorized to review this booking');
        }

        // Check if booking is completed
        if (lease.status !== 'COMPLETED') {
            throw new Error('Can only review completed bookings');
        }

        // Check if already reviewed
        const existingReview = await prisma.review.findUnique({
            where: { leaseId },
        });

        if (existingReview) {
            throw new Error('Booking already reviewed');
        }

        // Create review
        const review = await prisma.review.create({
            data: {
                propertyId,
                userId,
                leaseId,
                rating,
                comment: comment.trim(),
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        profilePicture: true,
                    },
                },
            },
        });

        // Update lease hasReview flag
        await prisma.lease.update({
            where: { id: leaseId },
            data: { hasReview: true },
        });

        return review;
    }

    /**
     * Get property reviews with pagination
     */
    async getPropertyReviews(propertyId, page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const [reviews, total] = await Promise.all([
            prisma.review.findMany({
                where: { propertyId },
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            profilePicture: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.review.count({ where: { propertyId } }),
        ]);

        // Calculate average rating
        const ratingAgg = await prisma.review.aggregate({
            where: { propertyId },
            _avg: { rating: true },
        });

        const averageRating = ratingAgg._avg.rating || 0;

        return {
            reviews,
            averageRating: Math.round(averageRating * 10) / 10,
            totalReviews: total,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get property rating summary
     */
    async getPropertyRating(propertyId) {
        // Get all reviews for distribution
        const reviews = await prisma.review.findMany({
            where: { propertyId },
            select: { rating: true },
        });

        const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        reviews.forEach((review) => {
            ratingDistribution[review.rating]++;
        });

        const total = reviews.length;
        const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
        const averageRating = total > 0 ? sum / total : 0;

        return {
            averageRating: Math.round(averageRating * 10) / 10,
            totalReviews: total,
            ratingDistribution,
        };
    }

    /**
     * Get user's reviews
     */
    async getUserReviews(userId, page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const [reviews, total] = await Promise.all([
            prisma.review.findMany({
                where: { userId },
                include: {
                    property: {
                        select: {
                            id: true,
                            title: true,
                            images: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.review.count({ where: { userId } }),
        ]);

        return {
            reviews,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Update review
     */
    async updateReview(reviewId, userId, data) {
        const { rating, comment } = data;

        // Validation
        if (rating && (rating < 1 || rating > 5)) {
            throw new Error('Rating must be between 1 and 5');
        }

        if (comment && comment.trim().length < 10) {
            throw new Error('Comment must be at least 10 characters');
        }

        // Check if review exists and belongs to user
        const review = await prisma.review.findUnique({
            where: { id: reviewId },
        });

        if (!review) {
            throw new Error('Review not found');
        }

        if (review.userId !== userId) {
            throw new Error('Not authorized to update this review');
        }

        // Update review
        const updatedReview = await prisma.review.update({
            where: { id: reviewId },
            data: {
                ...(rating && { rating }),
                ...(comment && { comment: comment.trim() }),
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        profilePicture: true,
                    },
                },
            },
        });

        return updatedReview;
    }

    /**
     * Delete review
     */
    async deleteReview(reviewId, userId) {
        // Check if review exists and belongs to user
        const review = await prisma.review.findUnique({
            where: { id: reviewId },
        });

        if (!review) {
            throw new Error('Review not found');
        }

        if (review.userId !== userId) {
            throw new Error('Not authorized to delete this review');
        }

        // Update lease hasReview flag
        await prisma.lease.update({
            where: { id: review.leaseId },
            data: { hasReview: false },
        });

        // Delete review
        await prisma.review.delete({
            where: { id: reviewId },
        });

        return true;
    }

    /**
     * Check if user can review property
     */
    async canReview(propertyId, userId) {
        // Find completed lease without review
        const lease = await prisma.lease.findFirst({
            where: {
                propertyId,
                tenantId: userId,
                status: 'COMPLETED',
                hasReview: false,
            },
            orderBy: { createdAt: 'desc' },
        });

        return {
            canReview: !!lease,
            leaseId: lease?.id,
        };
    }
}

module.exports = new ReviewsService();
