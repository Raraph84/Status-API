-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Oct 11, 2026 at 02:38 PM
-- Server version: 11.8.6-MariaDB-0+deb13u1 from Debian
-- PHP Version: 8.3.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `status`
--

-- --------------------------------------------------------

--
-- Table structure for table `checkers`
--

CREATE TABLE `checkers` (
  `checker_id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` varchar(100) NOT NULL,
  `location` varchar(50) NOT NULL,
  `check_second` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `groups`
--

CREATE TABLE `groups` (
  `group_id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `groups_checkers`
--

CREATE TABLE `groups_checkers` (
  `group_id` int(11) NOT NULL,
  `checker_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `groups_services`
--

CREATE TABLE `groups_services` (
  `group_id` int(11) NOT NULL,
  `service_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pages`
--

CREATE TABLE `pages` (
  `page_id` int(11) NOT NULL,
  `short_name` varchar(15) NOT NULL,
  `title` varchar(50) NOT NULL,
  `url` varchar(500) NOT NULL,
  `logo_url` varchar(500) NOT NULL,
  `domain` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pages_services`
--

CREATE TABLE `pages_services` (
  `page_id` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  `position` int(11) NOT NULL,
  `display_name` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pages_subpages`
--

CREATE TABLE `pages_subpages` (
  `page_id` int(11) NOT NULL,
  `subpage_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `services`
--

CREATE TABLE `services` (
  `service_id` int(11) NOT NULL,
  `type` varchar(25) NOT NULL,
  `name` varchar(50) NOT NULL,
  `host` varchar(100) NOT NULL,
  `protocol` tinyint(1) NOT NULL,
  `alert` tinyint(1) NOT NULL,
  `disabled` tinyint(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `services_daily_statuses`
--

CREATE TABLE `services_daily_statuses` (
  `service_id` tinyint(3) UNSIGNED NOT NULL,
  `checker_id` tinyint(3) UNSIGNED NOT NULL,
  `day` mediumint(8) UNSIGNED NOT NULL,
  `statuses_amount` smallint(5) UNSIGNED NOT NULL,
  `uptime` float DEFAULT NULL,
  `response_time` float DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `services_events`
--

CREATE TABLE `services_events` (
  `service_id` tinyint(3) UNSIGNED NOT NULL,
  `checker_id` tinyint(3) UNSIGNED NOT NULL,
  `minute` int(10) UNSIGNED NOT NULL,
  `online` tinyint(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `services_smokeping`
--

CREATE TABLE `services_smokeping` (
  `service_id` tinyint(3) UNSIGNED NOT NULL,
  `checker_id` tinyint(3) UNSIGNED NOT NULL,
  `start_time` int(10) UNSIGNED NOT NULL,
  `duration` tinyint(3) UNSIGNED NOT NULL,
  `checks` tinyint(3) UNSIGNED NOT NULL,
  `downs` tinyint(3) UNSIGNED DEFAULT NULL,
  `med_response_time` mediumint(8) UNSIGNED DEFAULT NULL,
  `min_response_time` mediumint(8) UNSIGNED DEFAULT NULL,
  `max_response_time` mediumint(8) UNSIGNED DEFAULT NULL,
  `lost` smallint(5) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
PARTITION BY KEY (`checker_id`,`service_id`)
PARTITIONS 128;

-- --------------------------------------------------------

--
-- Table structure for table `services_statuses`
--

CREATE TABLE `services_statuses` (
  `service_id` tinyint(3) UNSIGNED NOT NULL,
  `checker_id` tinyint(3) UNSIGNED NOT NULL,
  `minute` int(10) UNSIGNED NOT NULL,
  `online` tinyint(1) NOT NULL,
  `response_time` float DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `checkers`
--
ALTER TABLE `checkers`
  ADD PRIMARY KEY (`checker_id`);

--
-- Indexes for table `groups`
--
ALTER TABLE `groups`
  ADD PRIMARY KEY (`group_id`);

--
-- Indexes for table `groups_checkers`
--
ALTER TABLE `groups_checkers`
  ADD PRIMARY KEY (`group_id`,`checker_id`);

--
-- Indexes for table `groups_services`
--
ALTER TABLE `groups_services`
  ADD PRIMARY KEY (`group_id`,`service_id`);

--
-- Indexes for table `pages`
--
ALTER TABLE `pages`
  ADD PRIMARY KEY (`page_id`);

--
-- Indexes for table `pages_services`
--
ALTER TABLE `pages_services`
  ADD PRIMARY KEY (`page_id`,`service_id`);

--
-- Indexes for table `pages_subpages`
--
ALTER TABLE `pages_subpages`
  ADD PRIMARY KEY (`page_id`,`subpage_id`);

--
-- Indexes for table `services`
--
ALTER TABLE `services`
  ADD PRIMARY KEY (`service_id`);

--
-- Indexes for table `services_daily_statuses`
--
ALTER TABLE `services_daily_statuses`
  ADD PRIMARY KEY (`service_id`,`checker_id`,`day`);

--
-- Indexes for table `services_events`
--
ALTER TABLE `services_events`
  ADD PRIMARY KEY (`service_id`,`checker_id`,`minute`);

--
-- Indexes for table `services_smokeping`
--
ALTER TABLE `services_smokeping`
  ADD PRIMARY KEY (`start_time`,`checker_id`,`service_id`,`duration`),
  ADD KEY `service_id` (`service_id`,`checker_id`,`start_time`,`duration`);

--
-- Indexes for table `services_statuses`
--
ALTER TABLE `services_statuses`
  ADD PRIMARY KEY (`service_id`,`checker_id`,`minute`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `checkers`
--
ALTER TABLE `checkers`
  MODIFY `checker_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `groups`
--
ALTER TABLE `groups`
  MODIFY `group_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pages`
--
ALTER TABLE `pages`
  MODIFY `page_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `services`
--
ALTER TABLE `services`
  MODIFY `service_id` int(11) NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
